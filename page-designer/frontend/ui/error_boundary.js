// Top-level error boundary so an unexpected render error shows a recoverable
// message instead of a blank extension frame.

import {Component} from 'react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false};
    }

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidCatch(error, info) {
        // Surface to the console for support; the SDK has no error reporting hook.
        console.error('Page Designer extension error', error, info);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

// Boundary for a single rendered element so one bad element (e.g. a barcode whose
// data overflows the symbology) can't blank the whole page. Resets when `resetKey`
// changes identity, so editing a broken element re-attempts the render.
export class ElementBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false};
    }

    static getDerivedStateFromError() {
        return {hasError: true};
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({hasError: false});
        }
    }

    componentDidCatch(error) {
        console.error('Page Designer element render error', error);
    }

    render() {
        return this.state.hasError ? this.props.fallback ?? null : this.props.children;
    }
}
