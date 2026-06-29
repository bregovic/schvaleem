import { z } from "zod";

// POST /api/workitems – ERP posílá jeden aktivní workitem (obsah + assignee).
export const ingestWorkitemSchema = z.object({
  workflowId: z.string().min(1, "Pole 'workflowId' je povinné."),
  workitemId: z.string().min(1, "Pole 'workitemId' je povinné."),
  dataArea: z.string().min(1, "Pole 'dataArea' je povinné."),
  documentType: z.string().min(1, "Pole 'documentType' je povinné."),
  recordId: z.string().optional(),
  assigneeUserId: z.string().min(1, "Pole 'assigneeUserId' je povinné."),
  values: z.record(z.string(), z.unknown()).default({}),
});

// PATCH /api/workitems/{id} – ERP potvrdí převzetí (smazat) nebo dokončení bez uživatele.
export const patchWorkitemSchema = z.object({
  acknowledged: z.boolean().optional(),
  complete: z.boolean().optional(),
});

// POST /api/workflows/complete – workflow dokončeno v ERP, zavřít bez uživatele.
export const completeWorkflowSchema = z.object({
  workflowId: z.string().min(1, "Pole 'workflowId' je povinné."),
  dataArea: z.string().min(1, "Pole 'dataArea' je povinné."),
});

// POST /api/documents – PDF jako Base64 v JSON, navázané na workflow z ERP.
export const createDocumentSchema = z.object({
  filename: z.string().min(1, "Pole 'filename' je povinné."),
  workflowId: z.string().optional(), // erpWorkflowId
  dataArea: z.string().optional(),
  contentBase64: z.string().min(1, "Pole 'contentBase64' je povinné."),
});

export const loginSchema = z.object({
  email: z.string().email("Neplatný email."),
  password: z.string().min(1, "Zadej heslo."),
});
