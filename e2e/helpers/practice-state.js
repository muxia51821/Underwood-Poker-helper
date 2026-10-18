// Expand the stored references only for assertions about historical session contents.
export function expandPracticeRecord(record) {
  if (record?.version !== 2) return record;
  const { solutionSnapshots, ...state } = record;
  return { ...state, version: 1, sessions: state.sessions.map(({ solutionSnapshotHash, ...session }) =>
    solutionSnapshotHash ? { ...session, solutionSnapshot: solutionSnapshots[solutionSnapshotHash] } : session) };
}
export async function readPracticeState(page) {
  return expandPracticeRecord(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_practice_v1'))));
}
