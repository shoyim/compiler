import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import CodeMirror from 'codemirror';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/theme/darcula.css';
import 'codemirror/theme/material.css';
import 'codemirror/theme/nord.css';
import 'codemirror/theme/gruvbox-dark.css';
import 'codemirror/theme/3024-night.css';
import 'codemirror/theme/oceanic-next.css';
import 'codemirror/theme/idea.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/theme/mdn-like.css';
import 'codemirror/theme/neat.css';

import 'codemirror/mode/clike/clike';
import 'codemirror/mode/python/python';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/go/go';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/fortran/fortran';
import 'codemirror/mode/haskell/haskell';
import 'codemirror/mode/mllike/mllike';
import 'codemirror/mode/ruby/ruby';
import 'codemirror/mode/lua/lua';
import 'codemirror/mode/perl/perl';
import 'codemirror/mode/php/php';
import 'codemirror/mode/pascal/pascal';
import 'codemirror/mode/erlang/erlang';
import 'codemirror/mode/clojure/clojure';
import 'codemirror/mode/scheme/scheme';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/julia/julia';
import 'codemirror/mode/r/r';
import 'codemirror/mode/powershell/powershell';
import 'codemirror/mode/cobol/cobol';
import 'codemirror/mode/swift/swift';
import 'codemirror/mode/dart/dart';
import 'codemirror/mode/brainfuck/brainfuck';
import 'codemirror/mode/smalltalk/smalltalk';
import 'codemirror/mode/coffeescript/coffeescript';
import 'codemirror/mode/vb/vb';
import 'codemirror/mode/commonlisp/commonlisp';
import 'codemirror/mode/gas/gas';
import 'codemirror/mode/octave/octave';
import 'codemirror/mode/factor/factor';
import 'codemirror/mode/forth/forth';
import 'codemirror/mode/verilog/verilog';
import 'codemirror/mode/crystal/crystal';

import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/selection/active-line';

export interface CodeMirrorHandle {
  getValue: () => string;
  setValue: (v: string) => void;
  focus: () => void;
  refresh: () => void;
}

interface Props {
  mode: string;
  theme: string;
  onRun: () => void;
}

export const CodeMirrorEditor = forwardRef<CodeMirrorHandle, Props>(({ mode, theme, onRun }, ref) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<CodeMirror.Editor | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    if (!hostRef.current) return;
    const cm = CodeMirror(hostRef.current, {
      value: '',
      mode: 'text/plain',
      lineNumbers: true,
      tabSize: 4,
      indentUnit: 4,
      indentWithTabs: false,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      lineWrapping: false,
      extraKeys: {
        'Ctrl-Enter': () => onRunRef.current(),
        'Cmd-Enter': () => onRunRef.current(),
        Tab: 'indentMore',
        'Shift-Tab': 'indentLess',
      },
    } as CodeMirror.EditorConfiguration);
    cmRef.current = cm;
    return () => {
      cmRef.current = null;
    };
  }, []);

  useEffect(() => {
    cmRef.current?.setOption('mode', mode);
  }, [mode]);

  useEffect(() => {
    cmRef.current?.setOption('theme', theme);
  }, [theme]);

  useImperativeHandle(ref, () => ({
    getValue: () => cmRef.current?.getValue() ?? '',
    setValue: (v: string) => cmRef.current?.setValue(v),
    focus: () => cmRef.current?.focus(),
    refresh: () => cmRef.current?.refresh(),
  }));

  return <div ref={hostRef} className="h-full [&_.CodeMirror]:h-full [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-[13px]" />;
});
CodeMirrorEditor.displayName = 'CodeMirrorEditor';
