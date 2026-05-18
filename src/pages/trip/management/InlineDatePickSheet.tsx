import { useState } from 'react';

import { css } from '@emotion/react';
import { createPortal } from 'react-dom';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMetadataUpdate } from '@/domains/media/hooks/mutations';
import { MediaFile } from '@/domains/media/types';
import EditDate from '@/domains/trip/components/EditDate';
import { formatToISOLocal } from '@/libs/utils/date';
import { useToastStore } from '@/shared/stores/useToastStore';

interface InlineDatePickSheetProps {
    tripKey: string;
    targets: MediaFile[];
    onClose: () => void;
    onApplied: () => void;
}

const InlineDatePickSheet = ({ tripKey, targets, onClose, onApplied }: InlineDatePickSheetProps) => {
    const { showToast } = useToastStore();
    const { mutate: updateMutate, isPending: isApplying } = useMetadataUpdate();
    const [pickedDate, setPickedDate] = useState<Date | null>(null);

    const apply = () => {
        if (!pickedDate) return;
        const recordDate = formatToISOLocal(pickedDate);
        const updated = targets.map((t) => ({ ...t, recordDate }));

        updateMutate(
            { tripKey, images: updated },
            {
                onSuccess: (result) => {
                    if (result.success) {
                        showToast(`${updated.length}장에 날짜가 적용되었어요`);
                        onApplied();
                    } else {
                        showToast(result.error);
                    }
                },
            },
        );
    };

    const portalRoot = document.getElementById('portal-root') || document.body;

    return createPortal(
        <div css={overlayStyle}>
            <div css={backdropStyle} onClick={onClose} aria-hidden='true' />
            <div css={sheetStyle} role='dialog' aria-modal='true'>
                <EditDate
                    defaultDate={targets[0]?.recordDate || ''}
                    updatedDate={pickedDate}
                    setUpdatedDate={setPickedDate}
                    isUploading={isApplying}
                    uploadImagesWithDate={apply}
                    setIsDateEditing={(v) => {
                        if (!v) onClose();
                    }}
                />
            </div>
        </div>,
        portalRoot,
    );
};

const overlayStyle = css`
    position: fixed;
    inset: 0;
    z-index: 1000;
    font-family: ${MANAGE_TOKENS.font};
`;

const backdropStyle = css`
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.48);
    cursor: pointer;
`;

const sheetStyle = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 92dvh;
    background: ${MANAGE_TOKENS.card};
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
    overflow: hidden;
    display: flex;
    flex-direction: column;
`;

export default InlineDatePickSheet;
