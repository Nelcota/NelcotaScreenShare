/**
 * Whether someone else has been in the call during this connection. Once true it stays
 * true: being alone afterwards means everyone left, not that nobody has arrived yet.
 */
export function hasHadCompany(hadCompanyBefore: boolean, participantCount: number): boolean {
  if (hadCompanyBefore) return true;
  return participantCount > 1;
}
