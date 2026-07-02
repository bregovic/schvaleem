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
  // Metadata workflow (volitelné)
  documentTypeName: z.string().optional(),
  documentLabel: z.string().optional(),
  originator: z.string().optional(),
  originatorName: z.string().optional(), // reálné jméno zadavatele
  trackingStatus: z.string().optional(),
  createdDateTime: z.string().optional(),
  // Průběh schvalování (kroky + komentáře) z ERP – volitelné
  history: z
    .array(
      z.object({
        type: z.string().optional(), // druh kroku (schválení, dokončení…)
        user: z.string().optional(), // kdo (ERP userId)
        userName: z.string().optional(), // reálné jméno
        at: z.string().optional(), // kdy (ERP datum/čas)
        comment: z.string().optional(), // komentář
      }),
    )
    .optional(),
  // Metadata workitemu (volitelné)
  assigneeName: z.string().optional(), // reálné jméno řešitele
  subject: z.string().optional(),
  description: z.string().optional(),
  dueDateTime: z.string().optional(),
  workitemStatus: z.string().optional(),
  // PDF dokumenty rovnou v JSONu (volitelné) – název + obsah v Base64
  documents: z
    .array(
      z.object({
        filename: z.string().min(1),
        contentBase64: z.string().min(1),
      }),
    )
    .optional(),
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
  identifier: z.string().min(1, "Zadej email nebo ERP ID."),
  password: z.string().min(1, "Zadej heslo."),
});
