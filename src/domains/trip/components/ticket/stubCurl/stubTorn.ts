const DAY_PASS_ATTR = 'data-day-pass';
export const STUB_TORN_ATTR = 'data-stub-torn';

export const DAY_PASS_ROOT_PROPS = { [DAY_PASS_ATTR]: '' };

export const setStubTorn = (stub: HTMLElement, isTorn: boolean) => {
    stub.closest(`[${DAY_PASS_ATTR}]`)?.toggleAttribute(STUB_TORN_ATTR, isTorn);
};
