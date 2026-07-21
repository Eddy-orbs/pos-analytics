import {
    getDelegator,
    getGuardian,
    getGuardians,
    getOverview,
    getWeb3,
    getWeb3Polygon
} from 'pos-analytics-graph';
import axios from 'axios';
import { SupportedLanguage } from '../../global/types';
import { LOCAIZE_API, LOCAIZE_PROJECT_ID } from '../../global/variables';
import {BlockRef} from '../../redux/types/main-types'
class Api {
    async getDelegatorApi(address: string, web3: any, blockRef: BlockRef) {
        try {
            const res = await getDelegator(address, web3, undefined, blockRef );
            return res;
        } catch (error) {
            return undefined;
        }
    }

    async getGuardianApi(address: string, web3: any, blockRef: BlockRef) {
        try {
            return getGuardian(address, web3, undefined, blockRef);
        } catch (error) {
            return undefined;
        }
    }

    async getGuardiansApi(nodeEndpoints: string[]) {
        try {
            return getGuardians(nodeEndpoints);
        } catch (error) {
            return null;
        }
    }
    async getOverviewApi(nodeEndpoints: string[], web3: any) {
                        
        try {
            return getOverview(nodeEndpoints, web3);
        } catch (error) {
            console.log(error);
            
            return null;
        }
    }

    async getSupportedlanguages(): Promise<{ [id: string]: SupportedLanguage } | null> {
        try {
            const res = await axios.get(`${LOCAIZE_API}/languages/${LOCAIZE_PROJECT_ID}`);
            return res.data;
        } catch (error) {
            return null;
        }
    }
}

export const api = new Api();
