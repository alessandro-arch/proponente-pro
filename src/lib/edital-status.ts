/**
 * Computes the display status of an edital based on its DB status and dates.
 * - "Agendado" = published but before start_date
 * - "Aberto" = published and within start_date..end_date
 * - "Encerrado" = published and past end_date, OR status === "closed"
 * - "Rascunho" = status === "draft"
 */
export type ComputedEditalStatus = "Rascunho" | "Agendado" | "Aberto" | "Encerrado";

export function getComputedStatus(
  dbStatus: string,
  startDate: string | null,
  endDate: string | null
): ComputedEditalStatus {
  if (dbStatus === "draft") return "Rascunho";
  if (dbStatus === "closed") return "Encerrado";

  // published
  const now = new Date();
  if (startDate && new Date(startDate) > now) return "Agendado";
  if (endDate && new Date(endDate) < now) return "Encerrado";
  return "Aberto";
}

export function getStatusVariant(status: ComputedEditalStatus) {
  switch (status) {
    case "Rascunho": return "outline" as const;
    case "Agendado": return "secondary" as const;
    case "Aberto": return "default" as const;
    case "Encerrado": return "secondary" as const;
  }
}

/**
 * Whether the submission window is currently open for a given edital.
 */
export function isSubmissionOpen(
  dbStatus: string,
  startDate: string | null,
  endDate: string | null
): boolean {
  return getComputedStatus(dbStatus, startDate, endDate) === "Aberto";
}
