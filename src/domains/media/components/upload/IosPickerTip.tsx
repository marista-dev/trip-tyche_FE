import { css } from '@emotion/react';

import { isIOSWeb } from '@/platform';

/*
 * iPhone 웹 전용 안내.
 * iOS 사진 선택 창은 기본값('자동')에서 고른 사진을 전부 JPEG로 변환한 뒤에야 닫힌다. 그동안 멈춘 것처럼 보인다.
 * 웹 페이지는 이 동작을 바꿀 수 없다(WebKit 내부 설정). 사용자가 선택 창의 옵션에서 형식을 '현재'로 고르면
 * 변환을 건너뛴다. 실측(30장): ✓ 후 닫힐 때까지 12초 → 6초, 넘겨받는 용량 212MB → 152MB.
 * 남은 시간은 원본을 꺼내는 시간이라 장수에 비례하므로 나눠 고르기도 함께 안내한다.
 */
const IosPickerTip = () => {
    if (!isIOSWeb()) return null;
    return (
        <div css={tip} role='note'>
            <strong css={title}>iPhone에서 사진이 많을 때</strong>
            <ul css={list}>
                <li>
                    사진 선택 창 아래 <b>옵션</b>에서 형식을 <b>&apos;현재&apos;</b>로 바꾸면 2배 빨라요
                </li>
                <li>한 번에 30장 정도씩 나눠 고르면 기다림이 짧아요</li>
            </ul>
        </div>
    );
};

const tip = css`
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 12px;
    background: #f1f5f9;
    font-size: 12.5px;
    color: #475569;
    line-height: 1.6;
`;

const title = css`
    display: block;
    color: #0f172a;
    font-weight: 700;
    margin-bottom: 4px;
`;

const list = css`
    padding-left: 16px;
    list-style: disc;
`;

export default IosPickerTip;
