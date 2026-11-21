import { useQuery } from '@tanstack/react-query';

import { shareKeys } from '@/domains/share/queryKeys';
import { shareAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useShareDetail = (shareId: number) => {
    return useQuery({
        queryKey: shareKeys.detail(shareId),
        queryFn: () => toResult(() => shareAPI.fetchShareDetail(shareId)),
    });
};
