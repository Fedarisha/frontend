import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { create } from 'zustand'

import {
    CONFIG_PROFILES_VIEW_MODE,
    HOSTS_VIEW_MODE,
    IActions,
    IState,
    NODES_VIEW_MODE
} from './interfaces'

const initialState: IState = {
    nodesViewMode: NODES_VIEW_MODE.CARDS,
    configProfilesViewMode: CONFIG_PROFILES_VIEW_MODE.PROFILES,
    hostsViewMode: HOSTS_VIEW_MODE.CARDS
}

export const useViewPreferencesStore = create<IActions & IState>()(
    persist(
        devtools(
            (set) => ({
                ...initialState,
                actions: {
                    setNodesViewMode: (mode) => set({ nodesViewMode: mode }),
                    setConfigProfilesViewMode: (mode) => set({ configProfilesViewMode: mode }),
                    setHostsViewMode: (mode) => set({ hostsViewMode: mode }),
                    resetState: () => set({ ...initialState })
                }
            }),
            { name: 'viewPreferencesStore', anonymousActionType: 'viewPreferencesStore' }
        ),
        {
            name: 'viewPreferencesStore',
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                nodesViewMode: state.nodesViewMode,
                configProfilesViewMode: state.configProfilesViewMode,
                hostsViewMode: state.hostsViewMode
            }),
            migrate: () => initialState
        }
    )
)

export const useNodesViewMode = () => useViewPreferencesStore((state) => state.nodesViewMode)
export const useConfigProfilesViewMode = () =>
    useViewPreferencesStore((state) => state.configProfilesViewMode)
export const useViewPreferencesStoreActions = () =>
    useViewPreferencesStore((state) => state.actions)
export const useHostsViewMode = () => useViewPreferencesStore((state) => state.hostsViewMode)
