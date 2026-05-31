import { ReactNode } from 'react';

import { css } from '@emotion/react';

import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import PhotoListItem from '@/domains/media/components/manage/PhotoListItem';
import { managePageContainerStyle } from '@/domains/media/components/manage/styles';
import TaskContextCard from '@/domains/media/components/manage/TaskContextCard';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { MediaFile } from '@/domains/media/types';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';

/**
 * 이슈 해결 페이지(NoLocation / NoDate)에서 공통으로 쓰이는 풀-페이지 레이아웃.
 * 헤더 / 컨텍스트 카드 / 빠른 액션 영역 / 처리 대상 리스트 / 삭제 확인 모달까지 캡슐화.
 * 페이지 specific한 시트/모달은 `extraModals`로 주입.
 */
interface IssueResolveLayoutProps {
    title: string;
    subtitle: string;
    contextTone: 'red' | 'amber';
    contextIcon: ReactNode;
    contextText: ReactNode;
    quickActions: ReactNode;
    listTone: 'red' | 'amber';
    photoPrimaryLabel?: string;
    photoIssueLabel: string;
    emptyText: string;

    targets: MediaFile[];
    selected: Set<number>;
    allSelected: boolean;
    selectedCount: number;

    isLoading?: boolean;
    isDeleting?: boolean;

    onBack: () => void;
    onCancel: () => void;
    onDeleteRequest: () => void; // 헤더 삭제 버튼 클릭 → 보통 confirm modal 오픈
    onDeleteConfirm: () => void; // confirm modal에서 실제 삭제 실행
    onTogglePhoto: (photo: MediaFile) => void;
    onToggleAll: () => void;

    showDeleteConfirm: boolean;
    onCloseDeleteConfirm: () => void;
    deleteCount: number;

    extraModals?: ReactNode;
}

const IssueResolveLayout = ({
    title,
    subtitle,
    contextTone,
    contextIcon,
    contextText,
    quickActions,
    listTone,
    photoPrimaryLabel,
    photoIssueLabel,
    emptyText,
    targets,
    selected,
    allSelected,
    selectedCount,
    isLoading,
    isDeleting,
    onBack,
    onCancel,
    onDeleteRequest,
    onDeleteConfirm,
    onTogglePhoto,
    onToggleAll,
    showDeleteConfirm,
    onCloseDeleteConfirm,
    deleteCount,
    extraModals,
}: IssueResolveLayoutProps) => (
    <div css={managePageContainerStyle}>
        {(isLoading || isDeleting) && <Indicator text={isDeleting ? '사진 삭제 중...' : undefined} />}

        <ManageHeader
            title={title}
            subtitle={subtitle}
            selectedCount={selectedCount}
            onBack={onBack}
            onCancel={onCancel}
            onDelete={onDeleteRequest}
        />

        <TaskContextCard tone={contextTone} icon={contextIcon}>
            {contextText}
        </TaskContextCard>

        <div css={quickActionsStyle}>{quickActions}</div>

        <main css={bodyStyle}>
            <div css={sectionHeadStyle}>
                <h3 css={sectionLabelStyle}>처리 대상 · {targets.length}장</h3>
                {targets.length > 0 && (
                    <button type='button' css={toggleAllStyle} onClick={onToggleAll}>
                        {allSelected ? '모두 해제' : '모두 선택'}
                    </button>
                )}
            </div>

            {targets.length === 0 ? (
                <div css={emptyStyle}>{emptyText}</div>
            ) : (
                <div css={listStyle}>
                    {targets.map((p, i) => (
                        <PhotoListItem
                            key={p.mediaFileId}
                            photo={p}
                            tone={listTone}
                            selected={selected.has(p.mediaFileId)}
                            isFirst={i === 0}
                            onToggle={onTogglePhoto}
                            primaryLabel={photoPrimaryLabel}
                            issueLabel={photoIssueLabel}
                        />
                    ))}
                </div>
            )}
        </main>

        {showDeleteConfirm && (
            <ConfirmModal
                title={`${deleteCount}장의 사진 삭제`}
                description={`삭제한 여행 사진은 다시 복구할 수 없습니다.\n그래도 삭제하시겠습니까?`}
                confirmText='삭제'
                cancelText='취소'
                confirmModal={onDeleteConfirm}
                closeModal={onCloseDeleteConfirm}
            />
        )}

        {extraModals}
    </div>
);

const quickActionsStyle = css`
    display: flex;
    gap: 6px;
    padding: 0 20px 12px;
    background: ${MANAGE_TOKENS.card};
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
`;

const bodyStyle = css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px 32px;
`;

const sectionHeadStyle = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 4px 10px;
`;

const sectionLabelStyle = css`
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${MANAGE_TOKENS.text.label};
`;

const toggleAllStyle = css`
    background: transparent;
    border: none;
    color: ${MANAGE_TOKENS.accent};
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const listStyle = css`
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
    padding: 10px;
`;

const emptyStyle = css`
    padding: 40px 16px;
    text-align: center;
    color: ${MANAGE_TOKENS.text.muted};
    font-size: 13px;
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
`;

export default IssueResolveLayout;
