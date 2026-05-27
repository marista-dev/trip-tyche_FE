import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { Calendar, Clock, X } from 'lucide-react';
import 'dayjs/locale/ko';

import { hasValidDate } from '@/libs/utils/validate';
import Button from '@/shared/components/common/Button';
import { COLORS } from '@/shared/constants/style';

interface EditDateProps {
    defaultDate: string;
    updatedDate: Date | null;
    setUpdatedDate: Dispatch<SetStateAction<Date | null>>;
    isUploading?: boolean;
    uploadImagesWithDate: () => void;
    setIsDateEditing: (isDateVisible: boolean) => void;
}

const EditDate = ({
    defaultDate,
    setUpdatedDate,
    isUploading,
    uploadImagesWithDate,
    setIsDateEditing,
}: EditDateProps) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [timeValue, setTimeValue] = useState('');

    useEffect(() => {
        if (defaultDate && hasValidDate(defaultDate)) {
            const initialDate = new Date(defaultDate);
            setSelectedDate(initialDate);
            setUpdatedDate(initialDate);

            const hours = initialDate.getHours().toString().padStart(2, '0');
            const minutes = initialDate.getMinutes().toString().padStart(2, '0');
            setTimeValue(`${hours}:${minutes}`);
        }
    }, [defaultDate, setUpdatedDate]);

    const handleDateChange = (value: Date | null) => {
        if (value) {
            const newDate = new Date(value);
            if (selectedDate) {
                newDate.setHours(selectedDate.getHours());
                newDate.setMinutes(selectedDate.getMinutes());
            }
            setSelectedDate(newDate);
            setUpdatedDate(newDate);
        }
    };

    const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setTimeValue(value);

        if (value && selectedDate) {
            const [hours, minutes] = value.split(':').map(Number);

            if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                const newDate = new Date(selectedDate);
                newDate.setHours(hours);
                newDate.setMinutes(minutes);
                setSelectedDate(newDate);
                setUpdatedDate(newDate);
            }
        }
    };

    const handleClose = () => {
        setIsDateEditing(false);
        setUpdatedDate(null);
    };

    return (
        <div css={container}>
            <div css={xIconWrapper} onClick={handleClose}>
                <X />
            </div>

            <main css={content}>
                <div>
                    <h2 css={sectionTitle}>사진 날짜 수정</h2>
                    <p css={sectionDescription}>촬영한 날짜와 시간을 수정할 수 있습니다.</p>

                    <div css={inputContainer}>
                        <label css={labelStyle}>날짜</label>
                        <DatePickerInput
                            type='default'
                            placeholder='날짜를 선택해주세요'
                            value={selectedDate}
                            leftSection={<Calendar size={16} color={COLORS.PRIMARY} />}
                            locale='ko'
                            size='md'
                            radius='md'
                            valueFormat='YYYY년 MM월 DD일'
                            onChange={handleDateChange}
                            popoverProps={{
                                position: 'bottom',
                                zIndex: 9999,
                            }}
                            css={datePickerStyle}
                        />
                    </div>

                    <div css={inputContainer}>
                        <label css={labelStyle}>시간</label>
                        <TimeInput
                            value={timeValue}
                            leftSection={<Clock size={16} color={COLORS.PRIMARY} />}
                            onChange={handleTimeChange}
                            size='md'
                            radius='md'
                            css={datePickerStyle}
                            disabled={!selectedDate}
                        />
                    </div>
                </div>

                <div>
                    <h3 css={previewTitle}>변경 후 날짜 및 시간</h3>
                    <p css={datePreview}>
                        {selectedDate
                            ? selectedDate.toLocaleString('ko-KR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                              })
                            : '날짜를 선택해주세요'}
                    </p>
                </div>
            </main>

            <Button
                text='수정하기'
                disabled={!selectedDate || isUploading}
                onClick={uploadImagesWithDate}
                isLoading={isUploading}
                loadingText='날짜 수정 중...'
            />
        </div>
    );
};

const container = css`
    padding: 20px 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background-color: ${COLORS.BACKGROUND.WHITE};
    overflow: auto;
    position: relative;
`;

const xIconWrapper = css`
    position: absolute;
    top: 14px;
    right: 14px;
    cursor: pointer;
    z-index: 10;
    padding: 4px;

    &:hover {
        opacity: 0.7;
    }
`;

const content = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
`;

const sectionTitle = css`
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
    color: ${COLORS.TEXT.BLACK};
`;

const sectionDescription = css`
    font-size: 14px;
    color: ${COLORS.TEXT.DESCRIPTION_LIGHT};
    margin-bottom: 20px;
`;

const inputContainer = css`
    margin-bottom: 16px;
`;

const labelStyle = css`
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: ${COLORS.TEXT.DESCRIPTION};
`;

const datePickerStyle = css`
    width: 100%;

    input {
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const previewTitle = css`
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 16px;
    color: ${COLORS.TEXT.BLACK};
`;

const datePreview = css`
    font-size: 16px;
    font-weight: 600;
    color: ${COLORS.PRIMARY};
    padding: 12px;
    border: 1px solid ${COLORS.TEXT.DESCRIPTION_LIGHT}60;
    border-radius: 8px;
    text-align: center;
`;

export default EditDate;
