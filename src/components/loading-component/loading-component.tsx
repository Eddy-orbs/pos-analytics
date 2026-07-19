import React from 'react';
import { LoaderType } from '../../global/enums';
import { BigLoader } from '../loaders/big-loader';
import { ListLoader } from '../loaders/list-loader';
import { OneLineList } from '../loaders/one-line-list';
import { TextLoader } from '../loaders/text-loader';

interface StateProps {
    loaderType: LoaderType;
    isLoading: boolean;
    children: any;
    listElementAmount?: number;
    listLength?: number;
}

export const LoadingComponent = ({ loaderType, isLoading, children, listElementAmount, listLength }: StateProps) => {
    const renderContent = () => {
        switch (loaderType) {
            case LoaderType.TEXT:
                return <TextLoader />;
            case LoaderType.BIG:
                return <BigLoader />;
            case LoaderType.LIST:
                if (!listElementAmount) return null;
                return <ListLoader listElementAmount={listElementAmount} listLength = {listLength} />;
                case LoaderType.ONE_LINE:
                    if (!listElementAmount) return null;
                    return <OneLineList listElementAmount={listElementAmount} />
            default:
                break;
        }
    };

    return isLoading ? renderContent() : children;
};
