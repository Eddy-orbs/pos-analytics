import { Delegator, DelegatorInfo, Guardian, GuardianInfo } from 'pos-analytics-graph';
import {
    ChartColors,
    ChartUnit,
    ChartYaxis,
    DelegatorsSections,
    GuardianChartName,
    GuardiansSections,
    OverviewSections
} from './enums';

export interface MenuOption {
    name: string;
    route: string;
    key: DelegatorsSections | GuardiansSections | OverviewSections;
    disabled?: boolean;
}

export interface NavigationLink {
    name: string;
    route: string;
    image: string;
    selectedImage: string;
}

export interface RouteParams {
    section: string;
    address?: string;
}

export interface GuardianDataset {
    delegators: number;
    ownDelegation: number;
    totalDelegation: number;
}

export interface ChartData {
    datasets: ChartDataset[];
    unit: ChartUnit;
}

export interface ChartDataset {
    data: ChartDatasetObject[];
    color: ChartColors;
    yAxis: ChartYaxis;
}

export interface ChartDatasetObject {
    x: number;
    y: number | null;
}

export interface SearchInputResultElement {
    name: string;
    address: string;
}

export interface OverviewChartObject {
    date: string;
    data: Guardian[];
}

export interface OverviewChartData {
    data: OverviewChartObject[];
    unit: ChartUnit;
}

export interface BarChartDataset extends Guardian {
    color: string;
}

export interface SupportedLanguage {
    isReferenceLanguage: boolean;
    name: string;
    nativeName: string;
    region: string;
    translated: Translated;
}

interface Translated {
    latest: string;
}

export interface GuardiansChartDataset {
    data: ChartDatasetObject[];
    color: ChartColors;
    yAxis: ChartYaxis;
}

export interface GuardiansChartDatasets {
    self_stake: GuardiansChartDataset;
    total_stake: GuardiansChartDataset;
    n_delegates: GuardiansChartDataset;
}

export interface OverviewGuardianDataset {
    label: string;
    maxBarThickness: number;
    hoverBackgroundColor: undefined;
    data: GuardiansChartDatasetObject[];
    address?: string;
    order?: number;
    backgroundColor?: string;
}

export interface GuardiansChartDatasetObject {
    group: string;
    x: string | number;
    y: number | null;
}



export interface GuardianMobileRewards {
    selectedGuardian?: GuardianInfo;
        guardianIsLoading: boolean;
}


export interface DelegatorMobileRewards {
    selectedDelegator?: DelegatorInfo;
    delegatorIsLoading: boolean;
}