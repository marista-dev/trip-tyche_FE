import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateTripMedia } from '@/domains/media/queryKeys';
import { MediaFile } from '@/domains/media/types';
import { reprocessFailedMedia } from '@/domains/media/utils/reprocessMedia';
import { mediaAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';

export const useMediaDelete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tripKey, images }: { tripKey: string; images: MediaFile[] }) => {
            const mediaFilesId: number[] = images.map((image) => image.mediaFileId!);
            return toResult(() => mediaAPI.deleteImages(tripKey, mediaFilesId));
        },
        onSuccess: (_result, { tripKey }) => {
            void invalidateTripMedia(queryClient, tripKey);
        },
    });
};

export const useMetadataUpdate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tripKey, images }: { tripKey: string; images: MediaFile[] }) =>
            toResult(() => mediaAPI.updateMediaFileMetadata(tripKey, images)),
        onSuccess: (_result, { tripKey }) => {
            void invalidateTripMedia(queryClient, tripKey);
        },
    });
};

/** 처리에 실패한 사진을 다시 처리한다. 결과는 세션 스토어에 반영되고, 요약을 돌려준다. */
export const useMediaReprocess = () =>
    useMutation({
        mutationFn: ({ tripKey, mediaFileIds }: { tripKey: string; mediaFileIds: number[] }) =>
            reprocessFailedMedia(tripKey, mediaFileIds),
    });
