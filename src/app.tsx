import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getGuardiansAction} from './redux/actions/actions';
import { RootRouter } from './routes';
import './scss/app.scss';
import { AppState } from './redux/types/types';


const App = () => {
    const dispatch = useDispatch();
    const { chain } = useSelector((state: AppState) => state.main);

    useEffect(() => {
        dispatch(getGuardiansAction(chain));
    }, [chain, dispatch]);

   

    return (
        <div className="app">
            <RootRouter chain={chain} />
        </div>
    );
};

export default App;
