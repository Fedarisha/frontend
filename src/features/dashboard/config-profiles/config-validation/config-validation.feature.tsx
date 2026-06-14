import type { editor } from 'monaco-editor'

import { GetSnippetsCommand } from '@remnawave/backend-contract'
import consola from 'consola/browser'
import { RefObject } from 'react'
import dayjs from 'dayjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replaceSnippetsInArray = (array: any[], snippetsMap: Map<string, unknown>): void => {
    for (let i = array.length - 1; i >= 0; i--) {
        const item = array[i]

        if (item.snippet) {
            const snippet = snippetsMap.get(item.snippet)

            if (snippet) {
                if (Array.isArray(snippet)) {
                    array.splice(i, 1, ...snippet)
                } else {
                    // eslint-disable-next-line no-param-reassign
                    array[i] = snippet
                }
            } else {
                consola.error(`Snippet ${item.snippet} not found`)
                array.splice(i, 1)
            }
        }
    }
}

// The bundled Xray WASM validator only knows upstream Xray protocols. Fedarisha
// inbounds are validated by the backend and node, so use upstream placeholders
// while checking the rest of the config in the browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeFedarishaProtocolsForXrayValidation = (config: any): void => {
    if (Array.isArray(config.inbounds)) {
        config.inbounds = config.inbounds.map((inbound: unknown, index: number) => {
            if (
                !inbound ||
                typeof inbound !== 'object' ||
                (inbound as { protocol?: unknown }).protocol !== 'fedarisha'
            ) {
                return inbound
            }

            const sourceInbound = inbound as { tag?: unknown }

            return {
                listen: '127.0.0.1',
                port: 61000 + index,
                protocol: 'dokodemo-door',
                settings: {
                    address: '127.0.0.1',
                    network: 'tcp',
                    port: 1
                },
                tag:
                    typeof sourceInbound.tag === 'string' ? sourceInbound.tag : `fedarisha-${index}`
            }
        })
    }

    if (!Array.isArray(config.outbounds)) return

    config.outbounds = config.outbounds.map((outbound: unknown, index: number) => {
        if (
            !outbound ||
            typeof outbound !== 'object' ||
            (outbound as { protocol?: unknown }).protocol !== 'fedarisha'
        ) {
            return outbound
        }

        const sourceOutbound = outbound as { tag?: unknown }

        return {
            protocol: 'freedom',
            settings: {},
            tag:
                typeof sourceOutbound.tag === 'string'
                    ? sourceOutbound.tag
                    : `fedarisha-out-${index}`
        }
    })
}

export const ConfigValidationFeature = {
    validate: (
        editorRef: RefObject<editor.IStandaloneCodeEditor | null>,

        setResult: (message: string) => void,
        setIsConfigValid: (isValid: boolean) => void,
        snippetsMap: Map<
            string,
            GetSnippetsCommand.Response['response']['snippets'][number]['snippet']
        >
    ) => {
        try {
            if (!editorRef.current) return

            const currentValue = editorRef.current.getValue()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let clonedCurrentValue: any
            try {
                clonedCurrentValue = JSON.parse(currentValue)
            } catch {
                setResult(`${dayjs().format('HH:mm:ss')} | Invalid JSON.`)
                setIsConfigValid(false)
                return
            }

            if (clonedCurrentValue.outbounds) {
                replaceSnippetsInArray(clonedCurrentValue.outbounds, snippetsMap)
            }

            if (clonedCurrentValue.routing?.rules) {
                replaceSnippetsInArray(clonedCurrentValue.routing.rules, snippetsMap)
            }

            if (clonedCurrentValue.routing?.balancers) {
                replaceSnippetsInArray(clonedCurrentValue.routing.balancers, snippetsMap)
            }

            normalizeFedarishaProtocolsForXrayValidation(clonedCurrentValue)

            const validationResult = window.XrayParseConfig(JSON.stringify(clonedCurrentValue))

            setResult(
                `${dayjs().format('HH:mm:ss')} | ${validationResult || 'Xray config is valid.'}`
            )
            setIsConfigValid(!validationResult)
        } catch (err: unknown) {
            const message = (err as Error).message
            if (message?.includes('Go program has already exited')) {
                setResult(
                    `${dayjs().format('HH:mm:ss')} | WASM module crashed, restarting...`
                )
            } else {
                setResult(
                    `${dayjs().format('HH:mm:ss')} | Validation error: ${message}`
                )
            }
            setIsConfigValid(false)
        }
    }
}
