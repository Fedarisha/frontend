import { IconCrownFilled } from '@tabler/icons-react'
import { modals } from '@mantine/modals'

import { PrimeModalContent } from '../prime-modal/prime-modal.shared'
import classes from './PrimeControl.module.css'
import { HeaderControl } from './HeaderControl'

export function PrimeControl() {
    const openPrimeModal = () => {
        modals.open({
            centered: true,
            size: 460,
            withCloseButton: false,
            children: <PrimeModalContent />
        })
    }

    return (
        <HeaderControl className={classes.support} onClick={openPrimeModal}>
            <IconCrownFilled />
        </HeaderControl>
    )
}
