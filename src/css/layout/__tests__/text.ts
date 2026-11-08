import {deepStrictEqual} from 'assert';
import {breakTextareaLines} from '../text';
import {CSSParsedDeclaration} from '../../index';
import {LINE_BREAK} from '../../property-descriptors/line-break';
import {WORD_BREAK} from '../../property-descriptors/word-break';

const styles = {lineBreak: LINE_BREAK.NORMAL, wordBreak: WORD_BREAK.NORMAL} as CSSParsedDeclaration;

// 12 characters per line
const layout = (value: string): string[] => breakTextareaLines(value, 120, (text) => text.length * 10, styles);

describe('breakTextareaLines', () => {
    it('should wrap lines at word boundaries', () => {
        deepStrictEqual(layout(' A long text with several lines.'), [' A long text', 'with several', 'lines.']);
    });

    it('should let spaces hang at the end of a line', () => {
        deepStrictEqual(layout(' A long text     with several lines.  2'), [
            ' A long text',
            'with several',
            'lines.  2'
        ]);
        deepStrictEqual(layout('  A long text   with several lines.  2'), [
            '  A long',
            'text   with',
            'several',
            'lines.  2'
        ]);
    });

    it('should respect newlines', () => {
        deepStrictEqual(layout(' A long text\n    with\n\n several lines.'), [
            ' A long text',
            '    with',
            '',
            ' several',
            'lines.'
        ]);
        deepStrictEqual(layout('a\r\nb\n'), ['a', 'b', '']);
    });

    it('should break words that are wider than the textarea', () => {
        deepStrictEqual(layout('Donaudampfschifffahrtskapitänskoch 2'), [
            'Donaudampfsc',
            'hifffahrtska',
            'pitänskoch 2'
        ]);
        deepStrictEqual(layout('Donaudampfschifffahrtskapitänskoch\n 2'), [
            'Donaudampfsc',
            'hifffahrtska',
            'pitänskoch',
            ' 2'
        ]);
    });

    it('should wrap lines after hyphens', () => {
        deepStrictEqual(layout('Long text-message with sev lines.'), ['Long text-', 'message with', 'sev lines.']);
    });

    it('should return one empty line for an empty value', () => {
        deepStrictEqual(layout(''), ['']);
    });

    it('should not loop forever when nothing fits', () => {
        deepStrictEqual(
            breakTextareaLines('ab c', 0, (text) => text.length * 10, styles),
            ['a', 'b', 'c']
        );
    });
});
