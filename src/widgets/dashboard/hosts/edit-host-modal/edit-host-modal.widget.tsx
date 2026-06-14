import { UpdateHostCommand } from '@remnawave/backend-contract'
import { zodResolver } from 'mantine-form-zod-resolver'
import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PiListChecks } from 'react-icons/pi'
import { useForm } from '@mantine/form'
import { Drawer } from '@mantine/core'
import consola from 'consola/browser'

import {
    QueryKeys,
    useGetConfigProfiles,
    useGetHostTags,
    useGetInternalSquads,
    useGetNodes,
    useGetSubscriptionTemplates,
    useUpdateHost
} from '@shared/api/hooks'
import { MODALS, useModalClose, useModalState } from '@entities/dashboard/modal-store'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'
import { BaseHostForm } from '@shared/ui/forms/hosts/base-host-form'
import { queryClient } from '@shared/api'

export const EditHostModalWidget = memo(() => {
    const { t } = useTranslation()

    const { isOpen, internalState: host } = useModalState(MODALS.EDIT_HOST_MODAL)
    const close = useModalClose(MODALS.EDIT_HOST_MODAL)

    const [advancedOpened, setAdvancedOpened] = useState(false)

    const { data: configProfiles } = useGetConfigProfiles()
    const { data: nodes } = useGetNodes()
    const { data: templates } = useGetSubscriptionTemplates()
    const { data: internalSquads } = useGetInternalSquads()
    const { data: hostTags } = useGetHostTags()

    const form = useForm<UpdateHostCommand.Request>({
        name: 'edit-host-form',
        mode: 'uncontrolled',
        validateInputOnBlur: true,
        onValuesChange: (values) => {
            if (typeof values.vlessRouteId === 'string' && values.vlessRouteId === '') {
                form.setFieldValue('vlessRouteId', null)
            }
        },
        validate: zodResolver(UpdateHostCommand.RequestSchema.omit({ uuid: true }))
    })

    const handleClose = () => {
        close()

        setTimeout(() => {
            form.reset()
            form.resetDirty()
            form.resetTouched()
            setAdvancedOpened(false)
        }, 200)
    }

    const { mutate: updateHost, isPending: isUpdateHostPending } = useUpdateHost({
        mutationFns: {
            onSuccess: async () => {
                handleClose()
                await queryClient.refetchQueries({
                    queryKey: QueryKeys.hosts.getAllTags.queryKey
                })
            }
        }
    })

    useEffect(() => {
        if (host && configProfiles) {
            let xHttpExtraParamsParsed: null | object | string
            let muxParamsParsed: null | object | string
            let sockoptParamsParsed: null | object | string
            let finalMaskParsed: null | object | string

            if (typeof host.xHttpExtraParams === 'object' && host.xHttpExtraParams !== null) {
                xHttpExtraParamsParsed = JSON.stringify(host.xHttpExtraParams, null, 2)
            } else {
                xHttpExtraParamsParsed = ''
            }

            if (typeof host.muxParams === 'object' && host.muxParams !== null) {
                muxParamsParsed = JSON.stringify(host.muxParams, null, 2)
            } else {
                muxParamsParsed = ''
            }

            if (typeof host.sockoptParams === 'object' && host.sockoptParams !== null) {
                sockoptParamsParsed = JSON.stringify(host.sockoptParams, null, 2)
            } else {
                sockoptParamsParsed = ''
            }

            if (typeof host.finalMask === 'object' && host.finalMask !== null) {
                finalMaskParsed = JSON.stringify(host.finalMask, null, 2)
            } else {
                finalMaskParsed = ''
            }

            form.setValues({
                remark: host.remark,
                address: host.address,
                port: host.port,
                securityLayer: host.securityLayer,
                isDisabled: !host.isDisabled,
                sni: host.sni ?? undefined,
                host: host.host ?? undefined,
                path: host.path ?? undefined,
                alpn: (host.alpn as UpdateHostCommand.Request['alpn']) ?? undefined,
                fingerprint:
                    (host.fingerprint as UpdateHostCommand.Request['fingerprint']) ?? undefined,
                inbound: {
                    configProfileUuid: host.inbound.configProfileUuid ?? '',
                    configProfileInboundUuid: host.inbound.configProfileInboundUuid ?? ''
                },
                serverDescription: host.serverDescription ?? undefined,
                xHttpExtraParams: xHttpExtraParamsParsed,
                muxParams: muxParamsParsed,
                sockoptParams: sockoptParamsParsed,
                finalMask: finalMaskParsed,
                tags: host.tags ?? undefined,
                isHidden: host.isHidden,
                overrideSniFromAddress: host.overrideSniFromAddress,
                keepSniBlank: host.keepSniBlank,
                vlessRouteId: host.vlessRouteId ?? undefined,
                pinnedPeerCertSha256: host.pinnedPeerCertSha256 ?? undefined,
                verifyPeerCertByName: host.verifyPeerCertByName ?? undefined,
                shuffleHost: host.shuffleHost ?? undefined,
                mihomoX25519: host.mihomoX25519 ?? undefined,
                mihomoIpVersion: host.mihomoIpVersion ?? undefined,
                nodes: host.nodes ?? undefined,
                xrayJsonTemplateUuid: host.xrayJsonTemplateUuid ?? undefined,
                excludedInternalSquads: host.excludedInternalSquads ?? undefined,
                excludeFromSubscriptionTypes: host.excludeFromSubscriptionTypes ?? undefined
            })
        }
    }, [host, configProfiles])

    form.watch('inbound.configProfileInboundUuid', ({ value }) => {
        const { inbound } = form.getValues()
        if (!inbound?.configProfileUuid) {
            return
        }

        const configProfile = configProfiles?.configProfiles.find(
            (configProfile) => configProfile.uuid === inbound.configProfileUuid
        )
        if (configProfile) {
            form.setFieldValue(
                'port',
                configProfile.inbounds.find((inbound) => inbound.uuid === value)?.port ?? undefined
            )
        }
    })

    const handleSubmit = form.onSubmit(async (values) => {
        if (!host) {
            return
        }

        let xHttpExtraParams
        let muxParams
        let sockoptParams
        let finalMask

        try {
            if (values.xHttpExtraParams === '') {
                xHttpExtraParams = null
            } else {
                xHttpExtraParams = JSON.parse(values.xHttpExtraParams as unknown as string)
            }
        } catch (error) {
            consola.error(error)
            xHttpExtraParams = null
            // silence
        }

        try {
            if (values.muxParams === '') {
                muxParams = null
            } else {
                muxParams = JSON.parse(values.muxParams as unknown as string)
            }
        } catch (error) {
            consola.error(error)
            muxParams = null
            // silence
        }

        try {
            if (values.sockoptParams === '') {
                sockoptParams = null
            } else {
                sockoptParams = JSON.parse(values.sockoptParams as unknown as string)
            }
        } catch (error) {
            consola.error(error)
            sockoptParams = null
            // silence
        }

        try {
            if (values.finalMask === '') {
                finalMask = null
            } else {
                finalMask = JSON.parse(values.finalMask as unknown as string)
            }
        } catch (error) {
            consola.error(error)
            finalMask = null
            // silence
        }

        updateHost({
            variables: {
                ...values,
                isDisabled: !values.isDisabled,
                uuid: host.uuid,
                xHttpExtraParams,
                muxParams,
                sockoptParams,
                finalMask
            }
        })
    })

    return (
        <Drawer
            keepMounted={false}
            onClose={handleClose}
            opened={isOpen}
            overlayProps={{ backgroundOpacity: 0.6, blur: 0 }}
            padding="lg"
            position="right"
            size="lg"
            title={
                <BaseOverlayHeader
                    iconColor="teal"
                    IconComponent={PiListChecks}
                    iconVariant="soft"
                    subtitle={host?.uuid}
                    title={t('edit-host-modal.widget.edit-host')}
                    withCopy={true}
                />
            }
        >
            {host && (
                <BaseHostForm
                    advancedOpened={advancedOpened}
                    configProfiles={configProfiles?.configProfiles ?? []}
                    form={form}
                    handleSubmit={handleSubmit}
                    hostTags={hostTags?.tags ?? []}
                    internalSquads={internalSquads?.internalSquads ?? []}
                    isSubmitting={isUpdateHostPending}
                    nodes={nodes!}
                    setAdvancedOpened={setAdvancedOpened}
                    subscriptionTemplates={templates?.templates ?? []}
                />
            )}
        </Drawer>
    )
})
