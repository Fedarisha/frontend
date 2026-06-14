import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GetAllHostsCommand } from '@remnawave/backend-contract'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Box, Container, Stack } from '@mantine/core'
import { motion } from 'framer-motion'

import { HostCardWidget } from '@widgets/dashboard/hosts/host-card'
import { EmptyPageLayout } from '@shared/ui/layouts/empty-page'
import { useGetNodes } from '@shared/api/hooks'
import { useIsMobile } from '@shared/hooks'

import { IProps } from './interfaces'

export const HostsTableWidget = memo((props: IProps) => {
    const { configProfiles, handlers, hosts, selectedHosts, setSelectedHosts, state } = props
    const [draggedHost, setDraggedHost] = useState<
        GetAllHostsCommand.Response['response'][number] | null
    >(null)

    const [scrollMargin, setScrollMargin] = useState(0)
    const listRef = useRef<HTMLDivElement | null>(null)
    const isMobile = useIsMobile()

    const { data: nodes } = useGetNodes()

    useEffect(() => {
        if (listRef.current) {
            setScrollMargin(listRef.current.offsetTop)
        }
    }, [])

    const virtualizer = useWindowVirtualizer({
        count: state.length,
        estimateSize: () => (isMobile ? 202 : 88),
        overscan: 5,
        scrollMargin,
        getItemKey: (index) => state[index].uuid
    })

    const dataIds = useMemo(() => state.map((host) => host.uuid), [state])

    const nodesByUuid = useMemo(
        () => new Map((nodes ?? []).map((node) => [node.uuid, node] as const)),
        [nodes]
    )

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5
            }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, {})
    )

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const draggedItem = state.find((item) => item.uuid === event.active.id)
            setDraggedHost(draggedItem || null)
        },
        [state]
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event

            if (!over || active.id === over.id) {
                setDraggedHost(null)
                return
            }

            const oldIndex = dataIds.indexOf(String(active.id))
            const newIndex = dataIds.indexOf(String(over.id))

            if (oldIndex !== -1 && newIndex !== -1) {
                const newState = arrayMove(state, oldIndex, newIndex)
                handlers.setState(newState)
            }

            setDraggedHost(null)
        },
        [dataIds, state, handlers]
    )

    const handleDragCancel = useCallback(() => {
        setDraggedHost(null)
    }, [])

    const toggleHostSelection = useCallback(
        (hostId: string) => {
            setSelectedHosts((prev) =>
                prev.includes(hostId) ? prev.filter((id) => id !== hostId) : [...prev, hostId]
            )
        },
        [setSelectedHosts]
    )

    if (!hosts || !configProfiles) {
        return null
    }

    return (
        <Stack gap="md">
            {hosts.length === 0 && <EmptyPageLayout />}

            {hosts.length > 0 && (
                <DndContext
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                    onDragStart={handleDragStart}
                    sensors={sensors}
                >
                    <div ref={listRef}>
                        <div
                            style={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative'
                            }}
                        >
                            <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                                <Container fluid>
                                    <Stack gap={0}>
                                        {virtualizer.getVirtualItems().map((virtualItem) => {
                                            const item = state[virtualItem.index]
                                            if (!item) return null

                                            return (
                                                <Box
                                                    data-index={virtualItem.index}
                                                    key={item.uuid}
                                                    style={{
                                                        position: 'absolute',
                                                        marginLeft: isMobile ? '0px' : '16px',
                                                        marginRight: isMobile ? '0px' : '16px',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        transform: `translateY(${
                                                            virtualItem.start -
                                                            virtualizer.options.scrollMargin
                                                        }px)`
                                                    }}
                                                >
                                                    <motion.div
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        initial={{ opacity: 0 }}
                                                        transition={{ duration: 0.1 }}
                                                    >
                                                        <HostCardWidget
                                                            configProfiles={configProfiles}
                                                            isSelected={selectedHosts.includes(
                                                                item.uuid
                                                            )}
                                                            item={item}
                                                            nodesByUuid={nodesByUuid}
                                                            onSelect={() =>
                                                                toggleHostSelection(item.uuid)
                                                            }
                                                        />
                                                    </motion.div>
                                                </Box>
                                            )
                                        })}
                                    </Stack>
                                </Container>
                            </SortableContext>
                        </div>
                    </div>

                    <DragOverlay>
                        {draggedHost && (
                            <Container fluid pl={0} pr={0}>
                                <HostCardWidget
                                    configProfiles={configProfiles}
                                    isDragOverlay
                                    isSelected={selectedHosts.includes(draggedHost.uuid)}
                                    item={draggedHost}
                                    nodesByUuid={nodesByUuid}
                                    onSelect={() => toggleHostSelection(draggedHost.uuid)}
                                />
                            </Container>
                        )}
                    </DragOverlay>
                </DndContext>
            )}
        </Stack>
    )
})
