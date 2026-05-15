import {
    GetSnippetsCommand,
    ResponseRulesConfigSchema,
    TSubscriptionTemplateType
} from '@remnawave/backend-contract'
import zodToJsonSchema, { jsonDescription } from 'zod-to-json-schema'
import { NodePluginSchema } from '@remnawave/node-plugins'
import { Monaco } from '@monaco-editor/react'
import consola from 'consola'
import axios from 'axios'

import { monacoTheme } from '@shared/constants/monaco-theme'
import { app } from 'src/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonSchema = Record<string, any>

const FEDARISHA_STORAGE_SCHEMA = {
    additionalProperties: false,
    properties: {
        accessKey: { type: 'string' },
        bucket: { type: 'string' },
        endpoint: { type: 'string' },
        localDir: { type: 'string' },
        prefix: { type: 'string' },
        region: { type: 'string' },
        secretKey: { type: 'string' },
        sessionsDir: { type: 'string' },
        type: { type: 'string' }
    },
    title: 'FedarishaStorageConfig',
    type: 'object'
}

const FEDARISHA_TUNING_SCHEMA = {
    additionalProperties: false,
    properties: {
        idleTimeoutSec: { minimum: 0, type: 'integer' },
        maxFileSizeBytes: { minimum: 0, type: 'integer' },
        pollIntervalMs: { minimum: 0, type: 'integer' },
        writeIntervalMs: { minimum: 0, type: 'integer' }
    },
    title: 'FedarishaTuningConfig',
    type: 'object'
}

const FEDARISHA_USER_SCHEMA = {
    additionalProperties: false,
    properties: {
        email: { type: 'string' },
        id: { type: 'string' },
        level: { minimum: 0, type: 'integer' }
    },
    title: 'FedarishaUser',
    type: 'object'
}

const FEDARISHA_WEBHOOK_SCHEMA = {
    additionalProperties: false,
    properties: {
        autoSetup: { type: 'boolean' },
        enabled: { type: 'boolean' },
        listen: { type: 'string' },
        publicUrl: { type: 'string' },
        tlsCert: { type: 'string' },
        tlsKey: { type: 'string' }
    },
    title: 'FedarishaWebhookConfig',
    type: 'object'
}

const FEDARISHA_INBOUND_SETTINGS_SCHEMA = {
    additionalProperties: false,
    properties: {
        clients: {
            items: FEDARISHA_USER_SCHEMA,
            type: 'array'
        },
        storage: FEDARISHA_STORAGE_SCHEMA,
        tuning: FEDARISHA_TUNING_SCHEMA,
        userLevel: { minimum: 0, type: 'integer' },
        webhook: FEDARISHA_WEBHOOK_SCHEMA
    },
    required: ['storage'],
    title: 'FedarishaInboundConfigurationObject',
    type: 'object'
}

const FEDARISHA_OUTBOUND_SETTINGS_SCHEMA = {
    additionalProperties: false,
    properties: {
        storage: FEDARISHA_STORAGE_SCHEMA,
        tuning: FEDARISHA_TUNING_SCHEMA,
        userLevel: { minimum: 0, type: 'integer' }
    },
    required: ['storage'],
    title: 'FedarishaOutboundConfigurationObject',
    type: 'object'
}

const addConstVariant = (schema: JsonSchema | undefined, value: string) => {
    if (!schema) return

    if (Array.isArray(schema.anyOf)) {
        if (!schema.anyOf.some((item: JsonSchema) => item.const === value)) {
            schema.anyOf.push({ const: value })
        }
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        schema.enum.push(value)
    }
}

const addAnyOfVariant = (schema: JsonSchema | undefined, variant: JsonSchema) => {
    if (!schema) return

    if (!Array.isArray(schema.anyOf)) {
        schema.anyOf = []
    }

    if (!schema.anyOf.some((item: JsonSchema) => item.title === variant.title)) {
        schema.anyOf.push(variant)
    }
}

const patchFedarishaSchema = (schema: JsonSchema) => {
    const definitions = schema.definitions
    if (!definitions) return

    addConstVariant(definitions.InboundObject?.properties?.protocol, 'fedarisha')
    addConstVariant(definitions.OutboundObject?.properties?.protocol, 'fedarisha')

    addAnyOfVariant(definitions.InboundConfigurationObject, FEDARISHA_INBOUND_SETTINGS_SCHEMA)
    addAnyOfVariant(definitions.OutboundConfigurationObject, FEDARISHA_OUTBOUND_SETTINGS_SCHEMA)
}

export const MonacoSetupFeature = {
    setup: async (
        monaco: Monaco,
        currentLanguage: string,
        snippets: GetSnippetsCommand.Response['response']['snippets']
    ) => {
        try {
            const snippetNames = snippets.map((s) => s.name)

            let { jsonSchemaUrl } = app.configEditor
            switch (currentLanguage) {
                case 'zh':
                    jsonSchemaUrl = app.configEditor.jsonSchemaCnUrl
                    break
                default:
                    jsonSchemaUrl = app.configEditor.jsonSchemaUrl
            }

            const response = await axios.get(jsonSchemaUrl)
            const schema = await response.data
            patchFedarishaSchema(schema)

            const snippetDescriptions = snippets.map((snippet) => {
                const snippetJson = JSON.stringify(snippet.snippet, null, 1)

                return ['', '```json', snippetJson.slice(2, -2), '```', '', '---', ''].join('\n')
            })

            const snippetSchema = {
                name: 'snippet',
                title: 'Remnawave Snippets',
                markdownDescription:
                    'Create your own snippets to quickly configure your **Outbounds** or **Rules**. \n\n\nReference them here, Remnawave will handle the rest.',
                type: 'string',
                enum: snippetNames,
                markdownEnumDescriptions: snippetDescriptions,
                minLength: 2,
                maxLength: 255,
                pattern: '^[A-Za-z0-9_\\s-]+$',
                patternErrorMessage:
                    'Snippet name can only contain: letters, numbers, spaces, _ and -'
            }

            if (schema.definitions?.OutboundObject?.properties) {
                schema.definitions.OutboundObject.properties.snippet = snippetSchema
            }

            if (schema.definitions?.RuleObject?.properties) {
                schema.definitions.RuleObject.properties.snippet = snippetSchema
            }

            if (schema.definitions?.BalancerObject?.properties) {
                schema.definitions.BalancerObject.properties.snippet = snippetSchema
            }

            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                allowComments: false,
                enableSchemaRequest: true,
                schemaRequest: 'warning',
                schemas: [
                    {
                        fileMatch: ['*'],
                        schema,
                        uri: 'https://xray-config-schema.json'
                    }
                ],
                validate: true
            })
        } catch (error) {
            consola.error('Failed to load JSON schema:', error)
        }
    }
}
export const MonacoSetupSnippetsFeature = {
    setup: async (monaco: Monaco, currentLanguage: string) => {
        try {
            let { jsonSchemaUrl } = app.configEditor
            switch (currentLanguage) {
                case 'zh':
                    jsonSchemaUrl = app.configEditor.jsonSchemaCnUrl
                    break
                default:
                    jsonSchemaUrl = app.configEditor.jsonSchemaUrl
            }

            const response = await axios.get(jsonSchemaUrl)
            const schema = await response.data
            patchFedarishaSchema(schema)

            const snippetArraySchema = {
                $schema: 'http://json-schema.org/draft-07/schema#',
                title: 'Snippet Array',
                description: 'Array of Outbound, Rule or Balancer objects for snippets',
                type: 'array',
                items: {
                    oneOf: [
                        {
                            ...(schema.definitions?.OutboundObject || {}),
                            title: 'Outbound Object',
                            description: 'Outbound configuration (for outbounds[])'
                        },
                        {
                            ...(schema.definitions?.RuleObject || {}),
                            title: 'Rule Object',
                            description: 'Routing rule (for routing.rules[])'
                        },
                        {
                            ...(schema.definitions?.BalancerObject || {}),
                            title: 'Balancer Object',
                            description: 'Balancer configuration (for routing.balancers[])'
                        }
                    ]
                },
                minItems: 1,
                definitions: schema.definitions || {}
            }

            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                allowComments: false,
                enableSchemaRequest: true,
                schemaRequest: 'warning',
                schemas: [
                    {
                        fileMatch: ['snippet://*'],
                        schema: snippetArraySchema,
                        uri: 'https://snippet-schema.json'
                    }
                ],
                validate: true
            })

            return snippetArraySchema
        } catch (error) {
            consola.error('Failed to load snippet JSON schema:', error)
            return null
        }
    }
}

export const MonacoSetupResponseRulesFeature = {
    setup: async (
        monaco: Monaco,
        groupedTemplates: Record<TSubscriptionTemplateType, string[]>
    ) => {
        try {
            const schema = zodToJsonSchema(ResponseRulesConfigSchema, {
                name: 'Response Rules Config Schema',
                applyRegexFlags: true,
                errorMessages: true,
                postProcess: jsonDescription
            })

            const templateOptions = {
                BROWSER: [],
                BLOCK: [],
                STATUS_CODE_404: [],
                STATUS_CODE_451: [],
                SOCKET_DROP: [],
                ...groupedTemplates
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const schemaDefinitions = (schema as any).definitions?.['Response Rules Config Schema']
            const rulesItems = schemaDefinitions?.properties?.rules?.items

            if (rulesItems) {
                if (!rulesItems.allOf) {
                    rulesItems.allOf = []
                }

                Object.entries(templateOptions).forEach(([responseType, templates]) => {
                    if (templates.length > 0) {
                        rulesItems.allOf.push({
                            if: {
                                properties: {
                                    responseType: { const: responseType }
                                },
                                required: ['responseType']
                            },
                            then: {
                                properties: {
                                    responseModifications: {
                                        properties: {
                                            subscriptionTemplate: {
                                                enum: templates,
                                                markdownDescription: `Available templates for **${responseType}** response type.`,
                                                markdownEnumDescriptions: templates.map(
                                                    (t) => `Use ${t} template`
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    } else {
                        rulesItems.allOf.push({
                            if: {
                                properties: {
                                    responseType: { const: responseType }
                                },
                                required: ['responseType']
                            },
                            then: {
                                properties: {
                                    responseModifications: {
                                        properties: {
                                            subscriptionTemplate: {
                                                type: 'null',
                                                not: { type: 'string' },
                                                markdownDescription: `⚠️ No templates available for **${responseType}** response type. This field should not be used.`
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    }
                })
                //     } else {
                //         rulesItems.allOf.push({
                //             if: {
                //                 properties: {
                //                     responseType: { const: responseType }
                //                 },
                //                 required: ['responseType']
                //             },
                //             then: {
                //                 properties: {
                //                     responseModifications: {
                //                         properties: {
                //                             overrideSubscriptionTemplateWith: false
                //                         }
                //                     }
                //                 }
                //             }
                //         })
                //     }
                // })
            }

            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                schemaValidation: 'error',
                comments: 'error',
                trailingCommas: 'error',

                schemas: [
                    {
                        fileMatch: ['response-rules://*'],
                        schema,
                        uri: 'https://response-rules-schema.json'
                    }
                ],
                validate: true
            })

            monaco.languages.json.jsonDefaults.setModeConfiguration({
                documentFormattingEdits: true,
                documentRangeFormattingEdits: true,
                completionItems: true,
                hovers: true,
                documentSymbols: true,
                tokens: true,
                colors: true,
                foldingRanges: true,
                diagnostics: true,
                selectionRanges: true
            })

            monaco.editor.defineTheme('GithubDark', {
                ...monacoTheme,
                base: 'vs-dark'
            })
        } catch (error) {
            consola.error('Failed to load JSON schema:', error)
        }
    }
}

export const MonacoSetupNodePluginEditorFeature = {
    setup: async (monaco: Monaco) => {
        try {
            const schema = zodToJsonSchema(NodePluginSchema, {
                name: 'Node Plugin Schema',
                applyRegexFlags: true,
                errorMessages: true,
                postProcess: jsonDescription
            })

            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                schemaValidation: 'error',
                comments: 'error',
                trailingCommas: 'error',

                schemas: [
                    {
                        fileMatch: ['node-plugin://*'],
                        schema,
                        uri: 'https://node-plugin-schema.json'
                    }
                ],
                validate: true
            })

            monaco.languages.json.jsonDefaults.setModeConfiguration({
                documentFormattingEdits: true,
                documentRangeFormattingEdits: true,
                completionItems: true,
                hovers: true,
                documentSymbols: true,
                tokens: true,
                colors: true,
                foldingRanges: true,
                diagnostics: true,
                selectionRanges: true
            })

            monaco.editor.defineTheme('GithubDark', {
                ...monacoTheme,
                base: 'vs-dark'
            })
        } catch (error) {
            consola.error('Failed to load JSON schema:', error)
        }
    }
}
