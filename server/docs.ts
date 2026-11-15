import { Request, Response, Router } from 'express';
import { prisma } from './db';
import { requireAuth } from './auth';
import { canEditDoc, canPinDoc, canViewDoc, canWriteDocs, isLeadership, requireCan } from './permissions';
import { asyncRouter, validate } from './http';
import { docCreateSchema, docUpdateSchema } from './schemas';

// ===== G6: Kho tài liệu (link-based) =====
// department = 'Ban Chủ nhiệm' -> TÀI LIỆU CHUNG (mọi thành viên xem)
// department = ban cụ thể     -> riêng ban đó (ban mình + Ban lãnh đạo xem)
// Quyền ghi: Ban lãnh đạo mọi nơi; Trưởng ban/Phó ban chỉ trong ban mình.

export const docsRouter: Router = asyncRouter();

const DOC_TYPES = ['drive', 'sheet', 'doc', 'slide', 'pdf', 'image', 'form', 'other'];

export function registerDocsRoutes(apiRouter: Router): void {
  apiRouter.use('/docs', requireAuth, docsRouter);

  docsRouter.get('/', async (req: Request, res: Response) => {
    const me = req.authMember!;
    const { termId, all } = req.query;
    const where: Record<string, unknown> = {};
    if (termId) where.termId = String(termId);
    else if (!all) {
      const activeTerm = await prisma.term.findFirst({ where: { isActive: true } });
      where.termId = activeTerm ? activeTerm.id : undefined;
    }
    const docs = await prisma.doc.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: { createdBy: { select: { name: true } } },
    });
    const visible = docs.filter((d) => canViewDoc(me, d));
    res.json(
      visible.map((d) => ({
        id: d.id,
        name: d.name,
        url: d.url,
        docType: d.docType,
        department: d.department,
        termId: d.termId ?? undefined,
        label: d.label ?? undefined,
        pinned: d.pinned,
        createdByName: d.createdBy?.name,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }))
    );
  });

  docsRouter.post('/', requireCan(canWriteDocs, 'Chỉ Ban lãnh đạo hoặc Trưởng ban/Phó ban được đăng tài liệu'), async (req: Request, res: Response) => {
    const me = req.authMember!;
    const { name, url, docType, department, termId, label } = validate(docCreateSchema, req.body);
    const dept = isLeadership(me)
      ? (department || 'Ban Chủ nhiệm')
      : me.department; // TB/PB chỉ đăng cho ban mình
    const activeTerm = termId
      ? await prisma.term.findUnique({ where: { id: termId } })
      : await prisma.term.findFirst({ where: { isActive: true } });

    const doc = await prisma.doc.create({
      data: {
        name,
        url,
        docType: docType && DOC_TYPES.includes(docType) ? docType : 'other',
        department: dept,
        termId: activeTerm?.id ?? null,
        label: label ? label.trim() : null,
        createdById: me.id,
      },
    });
    return res.status(201).json({ ...doc, createdByName: me.name });
  });

  docsRouter.put('/:id', async (req: Request, res: Response) => {
    const me = req.authMember!;
    const doc = await prisma.doc.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    if (!canEditDoc(me, doc)) {
      return res.status(403).json({ error: 'Bạn chỉ được sửa tài liệu của ban mình' });
    }
    const { name, url, docType, department, label } = validate(docUpdateSchema, req.body);
    // Trưởng ban không được đổi ban tài liệu (chỉ lãnh đạo)
    const newDept = isLeadership(me) ? (department ?? doc.department) : doc.department;
    if (newDept !== doc.department && !isLeadership(me)) {
      return res.status(403).json({ error: 'Không thể đổi ban tài liệu' });
    }
    const updated = await prisma.doc.update({
      where: { id: doc.id },
      data: {
        name,
        url,
        docType: docType && DOC_TYPES.includes(docType) ? docType : undefined,
        department: newDept,
        label: label !== undefined ? (label ? label.trim() : null) : undefined,
      },
    });
    return res.json(updated);
  });

  docsRouter.delete('/:id', async (req: Request, res: Response) => {
    const me = req.authMember!;
    const doc = await prisma.doc.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    if (!canEditDoc(me, doc)) {
      return res.status(403).json({ error: 'Bạn chỉ được xóa tài liệu của ban mình' });
    }
    await prisma.doc.delete({ where: { id: doc.id } });
    return res.json({ success: true });
  });

  // Ghim tài liệu — chỉ Ban lãnh đạo
  docsRouter.post('/:id/pin', requireCan(canPinDoc, 'Chỉ Ban lãnh đạo được ghim tài liệu'), async (req: Request, res: Response) => {
    const doc = await prisma.doc.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    const updated = await prisma.doc.update({ where: { id: doc.id }, data: { pinned: !doc.pinned } });
    return res.json({ success: true, pinned: updated.pinned });
  });
}
