import { useState } from 'react';

import { css } from '@emotion/react';
import { Upload } from 'lucide-react';

import { isNative } from '@/platform';
import { COLORS } from '@/shared/constants/style';

interface UploadStepProps {
    onImageSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
    // 네이티브에서는 file input 대신 EXIF 원본을 보존하는 갤러리 피커를 연다.
    onNativePick: () => void;
}

const ACCENT = COLORS.PRIMARY;
const SOFT = COLORS.BACKGROUND.PRIMARY_LIGHT;
const SHADOW = 'rgba(0, 113, 227, 0.28)';

const CHIPS = ['GPS 자동 인식', '최대 20MB', '다중 선택 가능'];

const UploadStep = ({ onImageSelect, onNativePick }: UploadStepProps) => {
    const [hover, setHover] = useState(false);
    const native = isNative();

    return (
        <div css={container}>
            <div css={heroBlock}>
                <h2 css={heroTitle}>
                    여행의 기억을
                    <br />
                    <span css={heroAccent}>사진</span>으로 시작해요
                </h2>
                <p css={heroSubtitle}>
                    GPS 정보가 있는 사진을 선택하면
                    <br />
                    자동으로 여행 경로가 만들어져요
                </p>
            </div>

            <label
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                onClick={native ? onNativePick : undefined}
                css={uploadCard(hover)}
            >
                {!native && (
                    <input
                        type='file'
                        accept='image/*,image/heic,image/heif'
                        multiple
                        css={hiddenInput}
                        onChange={onImageSelect}
                    />
                )}
                <div css={iconBox(hover)}>
                    <Upload size={26} color={hover ? '#fff' : ACCENT} strokeWidth={1.8} />
                </div>
                <div css={cardText}>
                    <div css={cardTitle}>{hover ? '탭하여 사진 선택' : '여기를 탭해서 선택'}</div>
                    <div css={cardSub}>JPG · HEIC · PNG</div>
                </div>
            </label>

            <div css={chipRow}>
                {CHIPS.map((label) => (
                    <div key={label} css={chip}>
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
};

const container = css`
    flex: 1;
    display: flex;
    flex-direction: column;
`;

const heroBlock = css`
    margin-bottom: 28px;
`;

const heroTitle = css`
    font-size: 28px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.7px;
    line-height: 1.2;
    margin-bottom: 10px;
`;

const heroAccent = css`
    color: ${ACCENT};
`;

const heroSubtitle = css`
    font-size: 13px;
    color: #64748b;
    line-height: 1.7;
`;

const uploadCard = (hover: boolean) => css`
    border-radius: 20px;
    border: ${hover ? `1.5px solid ${ACCENT}` : '1.5px dashed #e2e8f0'};
    background: ${hover ? SOFT : '#fafafa'};
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    transition: all 200ms;
    transform: ${hover ? 'translateY(-2px)' : 'translateY(0)'};
    box-shadow: ${hover ? `0 12px 28px ${SHADOW}` : 'none'};
`;

const hiddenInput = css`
    display: none;
`;

const iconBox = (hover: boolean) => css`
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: ${hover ? ACCENT : SOFT};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms;
`;

const cardText = css`
    text-align: center;
`;

const cardTitle = css`
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
`;

const cardSub = css`
    font-size: 12px;
    color: #94a3b8;
`;

const chipRow = css`
    margin-top: 14px;
    display: flex;
    gap: 8px;
`;

const chip = css`
    flex: 1;
    padding: 8px 6px;
    background: #fff;
    border-radius: 10px;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    border: 1px solid #f1f5f9;
`;

export default UploadStep;
