import useSWR from 'swr';
import { fetcher } from '../../../../../lib/fetcher';
import { API_URL } from '../../../../../lib/config';
import type { ArchiveDomainMarkDay } from '../../knowledge/archive';

/** Domain marks from existing heatmap API — no /api/archive_marks in K-30.11. */
export function useArchiveDomainMarks() {
  return useSWR<ArchiveDomainMarkDay[]>(
    `${API_URL}/api/heatmap`,
    fetcher,
    { revalidateOnFocus: false },
  );
}
