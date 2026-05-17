import { css } from '@emotion/react';

import characterImg from '@/assets/images/character-icon.png';
import { getIataFromCountryString } from '@/domains/trip/airport';
import { TICKET } from '@/domains/trip/constants';
import { Trip } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { formatToDot } from '@/libs/utils/date';
import { COLORS, FONT_SIZES } from '@/shared/constants/style';
import { useTicket3DEffect } from '@/shared/hooks/useTicket3DEffect';

interface IntroTicketProps {
    trip: Trip;
}

const MovableTripTicket = ({ trip }: IntroTicketProps) => {
    const { tripTitle, country, startDate, endDate, hashtags } = trip;
    const userInfo = useUserStore((state) => state.userInfo);

    const userNickname = userInfo?.nickname || '';
    const destinationIata = getIataFromCountryString(country);

    const { ticketStyle, handlers } = useTicket3DEffect();

    return (
        <article
            css={[container, interactionTicketStyle]}
            style={ticketStyle}
            onMouseMove={handlers.handleMouseMove}
            onMouseLeave={handlers.handleMouseLeave}
            onTouchStart={handlers.handleTouchStart}
            onTouchMove={handlers.handleTouchMove}
            onTouchEnd={handlers.handleTouchEnd}
        >
            <header css={headerStyle}>
                <div css={headerItem}>
                    <h3 css={labelStyle}>PASSENGER</h3>
                    <p css={valueStyle}>{userNickname}</p>
                </div>
                <div css={headerItem}>
                    <h3 css={labelStyle}>DATE</h3>
                    <p css={valueStyle}>{formatToDot(startDate)}</p>
                </div>
                <div css={headerItem}>
                    <h3 css={labelStyle}>DATE</h3>
                    <p css={valueStyle}>{formatToDot(endDate)}</p>
                </div>
                <div css={headerItem}>
                    <h3 css={labelStyle}>FLIGHT</h3>
                    <p css={valueStyle}>TYCHE AIR</p>
                </div>
            </header>

            <main css={contentStyle}>
                <div css={citiesStyle}>
                    <p css={countryNameStyle}>{TICKET.DEPARTURE_IATA}</p>
                    <div css={dotsAndCharacterContainer}>
                        <div css={pointDots}>
                            <div css={startPointDot} />
                            <div css={endPointDot} />
                        </div>
                        <div css={characterContainer}>
                            <img css={characterStyle} src={characterImg} alt='캐릭터' />
                            <div css={characterShadow}></div>
                        </div>
                    </div>
                    <p css={countryNameStyle}>{destinationIata}</p>
                </div>

                <div css={titleSection}>
                    <p css={titleLabelStyle}>Title</p>
                    <p css={titleValueStyle}>{tripTitle}</p>
                </div>

                <div css={contentFooter}>
                    <div css={hashtagGroup}>
                        {hashtags
                            .filter((tag) => tag !== '')
                            .map((tag, index) => (
                                <span key={index} css={hashtagStyle}>
                                    <span css={hashSymbol}>#</span> {tag}
                                </span>
                            ))}
                    </div>
                </div>
            </main>
        </article>
    );
};

const interactionTicketStyle = css`
    touch-action: none;
    box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.06),
        0 2px 4px -1px rgba(0, 0, 0, 0.08);
`;

const container = css`
    width: 100%;
    max-width: 428px;
    position: relative;
    margin-bottom: 24px;
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    background: transparent;
    user-select: none;
`;

const headerStyle = css`
    display: flex;
    justify-content: space-around;
    background: ${COLORS.PRIMARY};
    color: ${COLORS.BACKGROUND.WHITE};
    padding: 12px 0;
    position: relative;
    overflow: hidden;
`;

const headerItem = css`
    display: flex;
    flex-direction: column;
`;

const labelStyle = css`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 4px;
    font-weight: 500;
`;

const valueStyle = css`
    font-size: 12px;
    font-weight: 600;
`;

const contentStyle = css`
    width: 100%;
    padding: 16px 16px 12px 16px;
    display: flex;
    flex-direction: column;
    background: ${COLORS.BACKGROUND.WHITE_SECONDARY};
`;

const citiesStyle = css`
    display: flex;
    align-items: center;
`;

const countryNameStyle = css`
    font-size: 18px;
    font-weight: 700;
    color: ${COLORS.TEXT.BLACK};
`;

const dotsAndCharacterContainer = css`
    flex: 1;
    position: relative;
    margin: 0 12px;
    display: flex;
    align-items: center;
`;

const pointDots = css`
    width: 100%;
    height: 2px;
    background: #9ca3af;
`;

const startPointDot = css`
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #9ca3af;
    transform: translateY(-50%);
`;

const endPointDot = css`
    position: absolute;
    right: 0;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #9ca3af;
    transform: translateY(-50%);
`;

const characterContainer = css`
    width: 40px;
    height: 40px;
    position: absolute;
    left: 0%;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const characterStyle = css`
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 2;
`;

const characterShadow = css`
    position: absolute;
    bottom: -6px;
    width: 30px;
    height: 6px;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 70%);
    border-radius: 50%;
    z-index: 1;
`;

const titleSection = css`
    margin: 24px 0 -8px 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const titleLabelStyle = css`
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
`;

const titleValueStyle = css`
    font-size: 14px;
    font-weight: 600;
    color: #111827;
`;

const contentFooter = css`
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    align-items: end;
`;

const hashtagGroup = css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
`;

const hashtagStyle = css`
    background-color: #f0f0f0;
    color: #4b5563;
    padding: 5px 10px;
    border-radius: 9999px;
    font-size: ${FONT_SIZES.SM};
`;

const hashSymbol = css`
    color: ${COLORS.PRIMARY};
    font-weight: 700;
`;

export default MovableTripTicket;
