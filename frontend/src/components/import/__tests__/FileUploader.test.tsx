import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileUploader } from '../FileUploader'

// Mock the parser so tests do not depend on DOMParser XML parsing behaviour
vi.mock('../../../utils/zwoParser', () => ({
    parseZwoFile: vi.fn(),
}))

import { parseZwoFile } from '../../../utils/zwoParser'

const mockParseZwoFile = vi.mocked(parseZwoFile)

const MOCK_PARSED_WORKOUT = {
    fileName: 'session.zwo',
    name: 'Test Session',
    author: null,
    description: null,
    intervals: [],
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('FileUploader', () => {
    it('renders the upload button', () => {
        render(<FileUploader onFilesParsed={vi.fn()} />)
        expect(screen.getByText('Upload .zwo files')).toBeInTheDocument()
    })

    it('renders the load example button', () => {
        render(<FileUploader onFilesParsed={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Load example workout' })).toBeInTheDocument()
    })

    it('calls onFilesParsed with the parsed workout when a valid .zwo file is uploaded', async () => {
        const user = userEvent.setup()
        mockParseZwoFile.mockReturnValue(MOCK_PARSED_WORKOUT)

        const onFilesParsed = vi.fn()
        render(<FileUploader onFilesParsed={onFilesParsed} />)

        const xmlContent = '<?xml version="1.0"?><workout_file><workout><SteadyState Duration="600" Power="0.88"/></workout></workout_file>'
        const file = new File([xmlContent], 'session.zwo', { type: 'application/xml' })
        const input = document.querySelector('input[type="file"]') as HTMLInputElement

        await user.upload(input, file)

        await waitFor(() => {
            expect(onFilesParsed).toHaveBeenCalledWith([MOCK_PARSED_WORKOUT])
        })
    })

    it('shows an error message when the .zwo file fails to parse', async () => {
        const user = userEvent.setup()
        mockParseZwoFile.mockImplementation(() => {
            throw new Error('session.zwo is not valid XML.')
        })

        render(<FileUploader onFilesParsed={vi.fn()} />)

        const file = new File(['not xml'], 'session.zwo', { type: 'application/xml' })
        const input = document.querySelector('input[type="file"]') as HTMLInputElement

        await user.upload(input, file)

        await waitFor(() => {
            expect(screen.getByText('session.zwo is not valid XML.')).toBeInTheDocument()
        })
    })

    it('does not call onFilesParsed when all selected files fail to parse', async () => {
        const user = userEvent.setup()
        mockParseZwoFile.mockImplementation(() => {
            throw new Error('Parse error')
        })

        const onFilesParsed = vi.fn()
        render(<FileUploader onFilesParsed={onFilesParsed} />)

        const file = new File(['invalid'], 'broken.zwo', { type: 'application/xml' })
        const input = document.querySelector('input[type="file"]') as HTMLInputElement

        await user.upload(input, file)

        await waitFor(() => {
            expect(onFilesParsed).not.toHaveBeenCalled()
        })
    })

    it('shows multiple error messages when multiple files fail to parse', async () => {
        const user = userEvent.setup()
        mockParseZwoFile
            .mockImplementationOnce(() => { throw new Error('Error in file 1.') })
            .mockImplementationOnce(() => { throw new Error('Error in file 2.') })

        render(<FileUploader onFilesParsed={vi.fn()} />)

        const files = [
            new File(['bad'], 'one.zwo', { type: 'application/xml' }),
            new File(['bad'], 'two.zwo', { type: 'application/xml' }),
        ]
        const input = document.querySelector('input[type="file"]') as HTMLInputElement

        await user.upload(input, files)

        await waitFor(() => {
            expect(screen.getByText('Error in file 1.')).toBeInTheDocument()
            expect(screen.getByText('Error in file 2.')).toBeInTheDocument()
        })
    })
})
