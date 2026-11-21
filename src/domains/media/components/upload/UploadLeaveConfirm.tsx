import { UPLOAD_GUARD_TEXT, type useUploadGuard } from '@/domains/media/hooks/useUploadGuard';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';

interface UploadLeaveConfirmProps {
    guard: ReturnType<typeof useUploadGuard>;
}

/** 업로드 중에 화면을 떠나려 할 때 묻는다. 막힌 이동이 없으면 그리지 않는다. */
const UploadLeaveConfirm = ({ guard }: UploadLeaveConfirmProps) =>
    guard.isLeaveBlocked ? (
        <ConfirmModal
            title={UPLOAD_GUARD_TEXT.leaveTitle}
            description={UPLOAD_GUARD_TEXT.leaveDescription}
            confirmText={UPLOAD_GUARD_TEXT.leaveConfirm}
            cancelText={UPLOAD_GUARD_TEXT.leaveCancel}
            confirmModal={guard.leave}
            closeModal={guard.stay}
        />
    ) : null;

export default UploadLeaveConfirm;
