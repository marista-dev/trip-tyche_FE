/** DayPassTicket 루트의 data-day-pass와 짝 */
const DAY_PASS_ATTR = 'data-day-pass';
/** 붙어 있는 동안 패스가 옆면 자리를 잘라 내 WebGL 조각만 보이게 한다 */
export const STUB_TORN_ATTR = 'data-stub-torn';

export const setStubTorn = (stub: HTMLElement, torn: boolean) => {
    stub.closest(`[${DAY_PASS_ATTR}]`)?.toggleAttribute(STUB_TORN_ATTR, torn);
};
