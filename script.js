'use strict';

(() => {
  const calculator = document.querySelector('.calculator');
  const expressionBefore = document.getElementById('expressionBefore');
  const expressionAfter = document.getElementById('expressionAfter');
  const expressionCursor = document.getElementById('expressionCursor');
  const expressionWindow = document.getElementById('expressionWindow');
  const accessibleExpression = document.getElementById('accessibleExpression');
  const resultDisplay = document.getElementById('resultDisplay');
  const leftIndicators = document.getElementById('leftIndicators');
  const angleIndicator = document.getElementById('angleIndicator');
  const formatIndicator = document.getElementById('formatIndicator');
  const keyButtons = Array.from(document.querySelectorAll('.key[data-primary], .key[data-action]'));

  const VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Y', 'M'];
  const FUNCTION_NAMES = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'asinh', 'acosh', 'atanh', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'exp',
    'floor', 'ceil', 'round'
  ]);
  const ANGLE_UNITS = ['DEG', 'RAD', 'GRA'];
  const DISPLAY_MODES = ['NORM', 'FIX', 'SCI'];
  const FUNCTION_ALIASES = [
    ['sin⁻¹', 'asin'], ['cos⁻¹', 'acos'], ['tan⁻¹', 'atan'],
    ['∛', 'cbrt'], ['√', 'sqrt']
  ];

  const state = {
    expression: '',
    cursor: 0,
    isShiftActive: false,
    isAlphaActive: false,
    isHyperbolicActive: false,
    isStoreArmed: false,
    isInsertMode: true,
    angleUnit: 'DEG',
    displayMode: 'NORM',
    memory: 0,
    lastAnswer: null,
    visibleResult: null,
    lastError: '',
    showFraction: false,
    fixDigits: 4,
    history: [],
    historyIndex: 0,
    variables: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, X: 0, Y: 0, M: 0 }
  };

  function setModeClasses() {
    calculator.classList.toggle('mode-shift', state.isShiftActive);
    calculator.classList.toggle('mode-alpha', state.isAlphaActive);
    calculator.classList.toggle('mode-hyp', state.isHyperbolicActive);
    calculator.classList.toggle('mode-store', state.isStoreArmed);
  }

  function updateDisplay() {
    const fullExpression = state.expression;
    const estimatedVisibleCharacters = Math.max(12, Math.floor((expressionWindow.clientWidth || 260) / 8.2));
    let start = 0;
    let end = fullExpression.length;

    if (fullExpression.length > estimatedVisibleCharacters) {
      const spareAfterCursor = Math.floor(estimatedVisibleCharacters * 0.32);
      start = Math.max(0, state.cursor - (estimatedVisibleCharacters - spareAfterCursor));
      end = Math.min(fullExpression.length, start + estimatedVisibleCharacters);
      if (end - start < estimatedVisibleCharacters) start = Math.max(0, end - estimatedVisibleCharacters);
    }

    const hiddenLeft = start > 0 ? '…' : '';
    const hiddenRight = end < fullExpression.length ? '…' : '';
    const cursorWithinWindow = Math.max(0, Math.min(end, state.cursor) - start);
    const leftPart = fullExpression.slice(start, start + cursorWithinWindow);
    const rightPart = fullExpression.slice(start + cursorWithinWindow, end);

    expressionBefore.textContent = hiddenLeft + leftPart;
    expressionAfter.textContent = rightPart + hiddenRight;
    expressionCursor.style.display = state.lastError && !state.expression ? 'none' : 'inline-block';
    accessibleExpression.textContent = fullExpression ? `Expression: ${fullExpression}` : 'Expression is empty';

    resultDisplay.textContent = state.lastError ? state.lastError : (state.visibleResult === null ? '' : formatResult(state.visibleResult));
    resultDisplay.title = state.lastError || (state.visibleResult === null ? '' : `Result: ${formatResult(state.visibleResult)}`);

    const indicators = [];
    if (state.isShiftActive) indicators.push('S');
    if (state.isAlphaActive) indicators.push('A');
    if (state.isHyperbolicActive) indicators.push('HYP');
    if (state.isStoreArmed) indicators.push('STO');
    if (state.memory !== 0) indicators.push('M');
    leftIndicators.replaceChildren(...indicators.map((indicator) => {
      const span = document.createElement('span');
      span.textContent = indicator;
      return span;
    }));

    angleIndicator.textContent = state.angleUnit === 'DEG' ? 'D' : state.angleUnit === 'RAD' ? 'R' : 'G';
    formatIndicator.textContent = state.displayMode === 'FIX' ? `FIX ${state.fixDigits}` : state.displayMode;
    setModeClasses();
  }

  function clearOneShotModes() {
    state.isShiftActive = false;
    state.isAlphaActive = false;
  }

  function insertText(text) {
    if (!text) return;
    const before = state.expression.slice(0, state.cursor);
    const after = state.expression.slice(state.cursor);

    if (!state.isInsertMode && state.cursor < state.expression.length) {
      state.expression = before + text + after.slice(text.length);
    } else {
      state.expression = before + text + after;
    }
    state.cursor += text.length;
    state.lastError = '';
    state.visibleResult = state.visibleResult;
    state.historyIndex = state.history.length;
    updateDisplay();
  }

  function deletePrevious() {
    if (state.cursor <= 0) return;
    const beforeCursor = state.expression.slice(0, state.cursor);
    const compoundToken = beforeCursor.match(/(?:sin⁻¹|cos⁻¹|tan⁻¹|sinh|cosh|tanh|asinh|acosh|atanh|sin|cos|tan|log|ln|√|∛|10\^|e\^|×10\^)\($/);
    const removeCount = compoundToken ? compoundToken[0].length : 1;
    state.expression = state.expression.slice(0, state.cursor - removeCount) + state.expression.slice(state.cursor);
    state.cursor -= removeCount;
    state.lastError = '';
    updateDisplay();
  }

  function clearExpression() {
    state.expression = '';
    state.cursor = 0;
    state.visibleResult = null;
    state.lastError = '';
    state.showFraction = false;
    state.isHyperbolicActive = false;
    state.isStoreArmed = false;
    clearOneShotModes();
    updateDisplay();
  }

  function moveCursor(direction) {
    if (direction === 'left') state.cursor = Math.max(0, state.cursor - 1);
    if (direction === 'right') state.cursor = Math.min(state.expression.length, state.cursor + 1);
    if (direction === 'up') recallHistory(-1);
    if (direction === 'down') recallHistory(1);
    updateDisplay();
  }

  function recallHistory(offset) {
    if (state.history.length === 0) return;
    state.historyIndex = Math.max(0, Math.min(state.history.length, state.historyIndex + offset));
    if (state.historyIndex === state.history.length) {
      state.expression = '';
    } else {
      state.expression = state.history[state.historyIndex];
    }
    state.cursor = state.expression.length;
    state.lastError = '';
  }

  function rememberExpression(expression) {
    if (!expression.trim()) return;
    if (state.history[state.history.length - 1] !== expression) state.history.push(expression);
    if (state.history.length > 60) state.history.shift();
    state.historyIndex = state.history.length;
  }

  function clearForNewInputIfError() {
    if (state.lastError) {
      state.expression = '';
      state.cursor = 0;
      state.lastError = '';
    }
  }

  function handleSpecialAction(action) {
    switch (action) {
      case 'shift':
        state.isShiftActive = !state.isShiftActive;
        state.isAlphaActive = false;
        updateDisplay();
        return true;
      case 'alpha':
        state.isAlphaActive = !state.isAlphaActive;
        state.isShiftActive = false;
        updateDisplay();
        return true;
      case 'cursor-left':
      case 'cursor-right':
      case 'cursor-up':
      case 'cursor-down':
        moveCursor(action.slice('cursor-'.length));
        return true;
      default:
        return false;
    }
  }

  function cycleAngleUnit() {
    const currentIndex = ANGLE_UNITS.indexOf(state.angleUnit);
    state.angleUnit = ANGLE_UNITS[(currentIndex + 1) % ANGLE_UNITS.length];
  }

  function cycleDisplayMode() {
    const currentIndex = DISPLAY_MODES.indexOf(state.displayMode);
    state.displayMode = DISPLAY_MODES[(currentIndex + 1) % DISPLAY_MODES.length];
  }

  function evaluateForMemory() {
    if (!state.expression.trim()) return state.lastAnswer ?? 0;
    return evaluateExpression(state.expression);
  }

  function performAction(action) {
    switch (action) {
      case 'mode':
        cycleAngleUnit();
        state.lastError = '';
        break;
      case 'setup':
        cycleDisplayMode();
        state.lastError = '';
        break;
      case 'on':
      case 'clear':
        clearExpression();
        return;
      case 'delete':
        clearForNewInputIfError();
        deletePrevious();
        break;
      case 'toggle-insert':
        state.isInsertMode = !state.isInsertMode;
        break;
      case 'hyp':
        state.isHyperbolicActive = !state.isHyperbolicActive;
        break;
      case 'calculate':
        calculateExpression();
        clearOneShotModes();
        updateDisplay();
        return;
      case 'toggle-result-format':
        state.showFraction = !state.showFraction;
        state.lastError = '';
        break;
      case 'memory-add':
      case 'memory-subtract': {
        try {
          const value = evaluateForMemory();
          state.memory += action === 'memory-add' ? value : -value;
          state.variables.M = state.memory;
          state.lastError = '';
          if (state.visibleResult === null) state.visibleResult = value;
        } catch (error) {
          state.lastError = error instanceof RangeError ? 'Math ERROR' : 'Syntax ERROR';
        }
        break;
      }
      case 'recall':
        insertText('M');
        break;
      case 'store':
        state.isStoreArmed = true;
        state.lastError = '';
        break;
      default:
        return false;
    }
    clearOneShotModes();
    updateDisplay();
    return true;
  }

  function resolveButtonValue(button) {
    const hasAlphaAlternative = state.isAlphaActive && button.dataset.alpha;
    const hasShiftAlternative = state.isShiftActive && button.dataset.shift;
    let value = hasAlphaAlternative ? button.dataset.alpha : hasShiftAlternative ? button.dataset.shift : button.dataset.primary;

    if (state.isHyperbolicActive && button.dataset.trig && !hasAlphaAlternative) {
      const trig = button.dataset.trig;
      value = hasShiftAlternative
        ? `${trig === 'sin' ? 'asinh' : trig === 'cos' ? 'acosh' : 'atanh'}(`
        : `${trig}h(`;
    }
    return value || '';
  }

  function handleKeyPress(button) {
    if (!button) return;
    const baseAction = button.dataset.action || '';
    if (handleSpecialAction(baseAction)) return;

    let selectedAction = baseAction;
    if (state.isAlphaActive && button.dataset.alphaAction) selectedAction = button.dataset.alphaAction;
    else if (state.isAlphaActive && button.dataset.alpha) selectedAction = '';
    else if (state.isShiftActive && button.dataset.shiftAction) selectedAction = button.dataset.shiftAction;

    if (selectedAction) {
      const handled = performAction(selectedAction);
      if (handled) return;
    }

    let value = resolveButtonValue(button);
    if (!value) {
      clearOneShotModes();
      updateDisplay();
      return;
    }

    if (state.isStoreArmed) {
      const variableName = value.trim();
      if (VARIABLE_NAMES.includes(variableName)) {
        try {
          const storedValue = state.expression.trim() ? evaluateExpression(state.expression) : (state.lastAnswer ?? 0);
          state.variables[variableName] = storedValue;
          if (variableName === 'M') state.memory = storedValue;
          state.visibleResult = storedValue;
          state.lastError = '';
        } catch (error) {
          state.lastError = error instanceof RangeError ? 'Math ERROR' : 'Syntax ERROR';
        }
        state.isStoreArmed = false;
        clearOneShotModes();
        updateDisplay();
        return;
      }
    }

    clearForNewInputIfError();
    insertText(value);
    clearOneShotModes();
    state.isHyperbolicActive = false;
    updateDisplay();
  }

  function calculateExpression() {
    if (!state.expression.trim()) {
      if (state.lastAnswer !== null) state.visibleResult = state.lastAnswer;
      state.lastError = '';
      return;
    }

    const expressionToCalculate = state.expression;
    try {
      const value = evaluateExpression(expressionToCalculate);
      if (!Number.isFinite(value)) throw new RangeError('Math ERROR');
      state.visibleResult = normalizeZero(value);
      state.lastAnswer = normalizeZero(value);
      state.lastError = '';
      state.showFraction = false;
      rememberExpression(expressionToCalculate);
      state.variables.M = state.memory;
    } catch (error) {
      state.lastError = error instanceof RangeError ? 'Math ERROR' : 'Syntax ERROR';
    }
  }

  function normalizeZero(value) {
    return Math.abs(value) < 1e-13 ? 0 : value;
  }

  function formatResult(value) {
    if (value === null || value === undefined) return '';
    if (!Number.isFinite(value)) return 'Math ERROR';
    if (state.showFraction) {
      const fraction = approximateFraction(value);
      if (fraction) return fraction;
    }
    if (state.displayMode === 'SCI') {
      return value === 0 ? '0' : value.toExponential(6).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e').replace('e+', 'E+').replace('e-', 'E−');
    }
    if (state.displayMode === 'FIX') return value.toFixed(state.fixDigits);
    const rounded = Number(value.toPrecision(10));
    return Object.is(rounded, -0) ? '0' : String(rounded).replace('e-', 'E−').replace('e+', 'E+');
  }

  function approximateFraction(value) {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    const sign = value < 0 ? -1 : 1;
    let x = Math.abs(value);
    let bestNumerator = Math.round(x);
    let bestDenominator = 1;
    let bestError = Math.abs(x - bestNumerator);
    for (let denominator = 1; denominator <= 1000; denominator += 1) {
      const numerator = Math.round(x * denominator);
      const error = Math.abs(x - numerator / denominator);
      if (error < bestError) {
        bestError = error;
        bestNumerator = numerator;
        bestDenominator = denominator;
        if (error < 1e-10) break;
      }
    }
    if (bestError > 1e-7) return '';
    return bestDenominator === 1 ? String(sign * bestNumerator) : `${sign * bestNumerator}/${bestDenominator}`;
  }

  function evaluateExpression(source) {
    const tokens = addImplicitMultiplication(tokenizeExpression(source));
    if (tokens.length === 0) throw new SyntaxError('Empty expression');
    const parser = new ExpressionParser(tokens, state);
    const result = parser.parse();
    if (typeof result !== 'number' || !Number.isFinite(result)) throw new RangeError('Math ERROR');
    return normalizeZero(result);
  }

  function tokenizeExpression(source) {
    const tokens = [];
    let index = 0;

    while (index < source.length) {
      const remaining = source.slice(index);
      const char = source[index];
      if (/\s/.test(char)) { index += 1; continue; }

      const numberMatch = remaining.match(/^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/);
      if (numberMatch) {
        tokens.push({ type: 'number', value: Number(numberMatch[0]), raw: numberMatch[0] });
        index += numberMatch[0].length;
        continue;
      }

      const alias = FUNCTION_ALIASES.find(([sourceAlias]) => remaining.startsWith(sourceAlias));
      if (alias) {
        tokens.push({ type: 'function', value: alias[1] });
        index += alias[0].length;
        continue;
      }

      if (char === 'π') { tokens.push({ type: 'constant', value: 'pi' }); index += 1; continue; }
      if (char === '×') { tokens.push({ type: 'operator', value: '*' }); index += 1; continue; }
      if (char === '÷') { tokens.push({ type: 'operator', value: '/' }); index += 1; continue; }
      if (char === '−' || char === '–') { tokens.push({ type: 'operator', value: '-' }); index += 1; continue; }
      if (char === '*') { tokens.push({ type: 'operator', value: '*' }); index += 1; continue; }
      if (char === '/') { tokens.push({ type: 'operator', value: '/' }); index += 1; continue; }
      if (char === '+') { tokens.push({ type: 'operator', value: '+' }); index += 1; continue; }
      if (char === '-') { tokens.push({ type: 'operator', value: '-' }); index += 1; continue; }
      if (char === '^') { tokens.push({ type: 'operator', value: '^' }); index += 1; continue; }
      if (char === '%') { tokens.push({ type: 'postfix', value: '%' }); index += 1; continue; }
      if (char === '!') { tokens.push({ type: 'postfix', value: '!' }); index += 1; continue; }
      if (char === '(') { tokens.push({ type: 'leftParen', value: '(' }); index += 1; continue; }
      if (char === ')') { tokens.push({ type: 'rightParen', value: ')' }); index += 1; continue; }

      const wordMatch = remaining.match(/^[A-Za-z][A-Za-z0-9]*/);
      if (wordMatch) {
        const word = wordMatch[0];
        if (word === 'Ans' || word.toLowerCase() === 'ans') {
          tokens.push({ type: 'variable', value: 'Ans' });
        } else if (FUNCTION_NAMES.has(word.toLowerCase())) {
          tokens.push({ type: 'function', value: word.toLowerCase() });
        } else if (word === 'pi' || word === 'PI') {
          tokens.push({ type: 'constant', value: 'pi' });
        } else if (word === 'e') {
          tokens.push({ type: 'constant', value: 'e' });
        } else if (word.length === 1 && VARIABLE_NAMES.includes(word)) {
          tokens.push({ type: 'variable', value: word });
        } else {
          throw new SyntaxError(`Unknown token: ${word}`);
        }
        index += word.length;
        continue;
      }

      throw new SyntaxError(`Unexpected character: ${char}`);
    }

    return tokens;
  }

  function addImplicitMultiplication(tokens) {
    const result = [];
    const canEndValue = (token) => ['number', 'constant', 'variable', 'rightParen', 'postfix'].includes(token.type);
    const canStartValue = (token) => ['number', 'constant', 'variable', 'function', 'leftParen'].includes(token.type);

    for (const token of tokens) {
      const previous = result[result.length - 1];
      if (previous && canEndValue(previous) && canStartValue(token)) {
        result.push({ type: 'operator', value: '*' });
      }
      result.push(token);
    }
    return result;
  }

  class ExpressionParser {
    constructor(tokens, calculatorState) {
      this.tokens = tokens;
      this.index = 0;
      this.state = calculatorState;
    }

    parse() {
      const value = this.parseExpression(0);
      if (this.index < this.tokens.length) throw new SyntaxError('Unexpected token');
      return value;
    }

    current() { return this.tokens[this.index]; }
    consume() { const token = this.current(); this.index += 1; return token; }

    parseExpression(minimumPrecedence) {
      let left = this.parsePrefix();

      while (this.index < this.tokens.length) {
        const token = this.current();
        if (token.type === 'postfix') {
          const precedence = 40;
          if (precedence < minimumPrecedence) break;
          this.consume();
          left = this.applyPostfix(token.value, left);
          continue;
        }
        if (token.type !== 'operator') break;

        const precedence = this.getPrecedence(token.value);
        if (precedence < minimumPrecedence) break;
        this.consume();
        const nextMinimum = token.value === '^' ? precedence : precedence + 1;
        const right = this.parseExpression(nextMinimum);
        left = this.applyBinary(token.value, left, right);
      }
      return left;
    }

    parsePrefix() {
      const token = this.consume();
      if (!token) throw new SyntaxError('Expression is incomplete');

      if (token.type === 'number') return token.value;
      if (token.type === 'constant') return token.value === 'pi' ? Math.PI : Math.E;
      if (token.type === 'variable') return this.resolveVariable(token.value);

      if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        const value = this.parseExpression(25);
        return token.value === '-' ? -value : value;
      }

      if (token.type === 'leftParen') {
        const value = this.parseExpression(0);
        if (!this.current() || this.current().type !== 'rightParen') throw new SyntaxError('Missing closing parenthesis');
        this.consume();
        return value;
      }

      if (token.type === 'function') {
        if (!this.current() || this.current().type !== 'leftParen') throw new SyntaxError('Function requires parentheses');
        this.consume();
        const argument = this.parseExpression(0);
        if (!this.current() || this.current().type !== 'rightParen') throw new SyntaxError('Missing closing parenthesis');
        this.consume();
        return this.applyFunction(token.value, argument);
      }

      throw new SyntaxError('Unexpected token');
    }

    resolveVariable(name) {
      if (name === 'Ans') return this.state.lastAnswer ?? 0;
      if (name === 'M') return this.state.memory;
      if (Object.prototype.hasOwnProperty.call(this.state.variables, name)) return this.state.variables[name];
      throw new SyntaxError(`Unknown variable: ${name}`);
    }

    getPrecedence(operator) {
      if (operator === '+' || operator === '-') return 10;
      if (operator === '*' || operator === '/') return 20;
      if (operator === '^') return 30;
      return -1;
    }

    applyBinary(operator, left, right) {
      switch (operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (right === 0) throw new RangeError('Division by zero');
          return left / right;
        case '^': return Math.pow(left, right);
        default: throw new SyntaxError('Unsupported operator');
      }
    }

    applyPostfix(operator, value) {
      if (operator === '%') return value / 100;
      if (operator === '!') {
        if (value < 0 || !Number.isInteger(value) || value > 170) throw new RangeError('Factorial domain error');
        let result = 1;
        for (let number = 2; number <= value; number += 1) result *= number;
        return result;
      }
      throw new SyntaxError('Unsupported postfix operator');
    }

    toRadians(value) {
      if (this.state.angleUnit === 'DEG') return value * Math.PI / 180;
      if (this.state.angleUnit === 'GRA') return value * Math.PI / 200;
      return value;
    }

    fromRadians(value) {
      if (this.state.angleUnit === 'DEG') return value * 180 / Math.PI;
      if (this.state.angleUnit === 'GRA') return value * 200 / Math.PI;
      return value;
    }

    applyFunction(name, value) {
      let result;
      switch (name) {
        case 'sin': result = Math.sin(this.toRadians(value)); break;
        case 'cos': result = Math.cos(this.toRadians(value)); break;
        case 'tan': result = Math.tan(this.toRadians(value)); break;
        case 'asin': result = this.fromRadians(Math.asin(value)); break;
        case 'acos': result = this.fromRadians(Math.acos(value)); break;
        case 'atan': result = this.fromRadians(Math.atan(value)); break;
        case 'sinh': result = Math.sinh(value); break;
        case 'cosh': result = Math.cosh(value); break;
        case 'tanh': result = Math.tanh(value); break;
        case 'asinh': result = Math.asinh(value); break;
        case 'acosh': result = Math.acosh(value); break;
        case 'atanh': result = Math.atanh(value); break;
        case 'log':
          if (value <= 0) throw new RangeError('Logarithm domain error');
          result = Math.log10(value);
          break;
        case 'ln':
          if (value <= 0) throw new RangeError('Logarithm domain error');
          result = Math.log(value);
          break;
        case 'sqrt':
          if (value < 0) throw new RangeError('Square root domain error');
          result = Math.sqrt(value);
          break;
        case 'cbrt': result = Math.cbrt(value); break;
        case 'abs': result = Math.abs(value); break;
        case 'exp': result = Math.exp(value); break;
        case 'floor': result = Math.floor(value); break;
        case 'ceil': result = Math.ceil(value); break;
        case 'round': result = Math.round(value); break;
        default: throw new SyntaxError(`Unsupported function: ${name}`);
      }
      if (!Number.isFinite(result)) throw new RangeError('Math ERROR');
      return result;
    }
  }

  function normalizeKeyboardCharacter(key) {
    if (key === '*') return '×';
    if (key === '/') return '÷';
    if (key === '-') return '−';
    return key;
  }

  function handleKeyboardInput(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const activeElement = document.activeElement;
    const focusedButton = activeElement instanceof HTMLButtonElement ? activeElement : null;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (focusedButton && focusedButton.classList.contains('replay-direction')) return;
      event.preventDefault();
      moveCursor(event.key === 'ArrowLeft' ? 'left' : 'right');
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      recallHistory(event.key === 'ArrowUp' ? -1 : 1);
      updateDisplay();
      return;
    }
    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      calculateExpression();
      clearOneShotModes();
      updateDisplay();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      clearForNewInputIfError();
      deletePrevious();
      return;
    }
    if (event.key === 'Escape' || event.key === 'Delete') {
      event.preventDefault();
      clearExpression();
      return;
    }

    const normalized = normalizeKeyboardCharacter(event.key);
    if (/^[0-9.+−×÷^()%!]$/.test(normalized)) {
      event.preventDefault();
      clearForNewInputIfError();
      insertText(normalized);
      return;
    }
    if (event.key === '(' || event.key === ')') {
      event.preventDefault();
      clearForNewInputIfError();
      insertText(event.key);
    }
  }

  // Pointer events handle mouse, pen, and touch immediately without double-firing a synthesized click.
  calculator.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    if (!button || !calculator.contains(button)) return;
    event.preventDefault();
    if (typeof button.focus === 'function') button.focus({ preventScroll: true });
    handleKeyPress(button);
  });

  // Native keyboard activation dispatches click events with detail === 0.
  calculator.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const button = event.target.closest('button');
    if (button && calculator.contains(button)) handleKeyPress(button);
  });

  document.addEventListener('keydown', handleKeyboardInput);
  window.addEventListener('resize', updateDisplay, { passive: true });

  // These buttons are used for the visual overlay only; the outer keypad still handles input.
  keyButtons.forEach((button) => {
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  // Initial screen state.
  updateDisplay();

  // Expose a tiny, read-only test surface for automated checks without using eval().
  window.CasioCalculator = Object.freeze({
    calculate: evaluateExpression,
    getState: () => ({
      expression: state.expression,
      cursor: state.cursor,
      angleUnit: state.angleUnit,
      displayMode: state.displayMode,
      lastAnswer: state.lastAnswer,
      memory: state.memory,
      variables: { ...state.variables }
    })
  });
})();
