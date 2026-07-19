import React, { useEffect } from 'react';
import moment from 'moment';
import { useState } from 'react';
import { generateDays } from 'utils/dates';
import CalendarTodayOutlinedIcon from '@material-ui/icons/CalendarTodayOutlined';
import { useClickOutside } from 'react-click-outside-hook';
import CloseIcon from '@material-ui/icons/Close';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import './days-selector.scss';

interface StateProps {
    selectDate: (date: Date) => void;
    initialDate?: Date | null;
}
export const DaysSelector = ({ selectDate, initialDate }: StateProps) => {
    const [ref, hasClickedOutside] = useClickOutside();

    const daysToSelect = generateDays(20);
    const [selectedDate, setSelectedDate] = useState<Date>(initialDate || moment().toDate());
    const [showDates, setShowDates] = useState<boolean>(false);
    const initialTimestamp = initialDate ? initialDate.getTime() : undefined;

    useEffect(() => {
        setShowDates(false);
    }, [hasClickedOutside]);

    useEffect(() => {
        if (initialTimestamp !== undefined) setSelectedDate(new Date(initialTimestamp));
    }, [initialTimestamp]);

    const select = (date: Date) => {
        setSelectedDate(date);
        selectDate(date);
        setShowDates(false)
       
    };

    useEffect(() => {
        const body: any = document.querySelector('body')
        if(!body) return
        const previousOverflow = body.style.overflow;
        body.style.overflow = showDates ? 'hidden' : '';
        return () => {
            body.style.overflow = previousOverflow;
        };
    }, [showDates])

    return (
        <div className="days-selector" ref={ref}>
            <section onClick={() => setShowDates(!showDates)} className="days-selector-selected flex-start-center">
               <figure className='days-selector-calendar'>
               <CalendarTodayOutlinedIcon  />
               </figure>
                <h5> {moment(selectedDate).format('DD.MM.YYYY')}</h5>
               <figure className='days-selector-drop'>
               <ArrowDropDownIcon />
               </figure>
            </section>
            {showDates && (
               <div className='days-selector-modal'>
                
                   <section 
                   onClick={() => setShowDates(false)}
                   className='overlay'></section>
                    <button onClick={() => setShowDates(false)}><CloseIcon /></button>
                    <ul className="days-selector-options" >
                   
                    {daysToSelect.map((day) => {
                        return <li key = {`${day}`} onClick={() => select(day)}>{moment(day).format('DD.MM.YYYY')}</li>;
                    })}
                </ul>
               </div>
            )}
        </div>
    );
};
