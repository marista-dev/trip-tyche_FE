/** 여행 목록 → 링에 올릴 티켓 데이터 */
import { RingTicket } from './ticketTexture';
import { getTicketView } from '@/domains/trip/ticketView';
import { TripSummary } from '@/domains/trip/types';

/** 최신 여행이 링 정면(0번)에 오도록. 날짜가 없는 작성 중 티켓은 뒤로 */
export const sortLatestFirst = (list: TripSummary[]) =>
    [...list].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

/** 사진 수는 목록 응답의 photoCount. 응답에 없으면 null(카드에 '—') */
export const toRingTickets = (list: TripSummary[], passenger: string): RingTicket[] =>
    list.map((trip) => {
        const completed = Boolean(trip.startDate);
        return {
            tripKey: trip.tripKey,
            title: trip.tripTitle,
            view: getTicketView(trip, { completed }),
            completed,
            passenger,
            photoCount: trip.photoCount ?? null,
        };
    });
