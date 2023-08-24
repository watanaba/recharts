import React, { PureComponent, SVGProps } from 'react';
interface PolarGridProps {
    cx?: number;
    cy?: number;
    innerRadius?: number;
    outerRadius?: number;
    polarAngles?: number[];
    polarRadius?: number[];
    gridType?: 'polygon' | 'circle';
    radialLines: boolean;
}
export declare type Props = SVGProps<SVGPathElement> & PolarGridProps;
export declare class PolarGrid extends PureComponent<Props> {
    static displayName: string;
    static defaultProps: {
        cx: number;
        cy: number;
        innerRadius: number;
        outerRadius: number;
        gridType: string;
        radialLines: boolean;
    };
    getPolygonPath(radius: number): string;
    renderPolarAngles(): React.JSX.Element;
    renderConcentricCircle(radius: number, index: number, extraProps?: SVGProps<SVGCircleElement>): React.JSX.Element;
    renderConcentricPolygon(radius: number, index: number, extraProps?: SVGProps<SVGPathElement>): React.JSX.Element;
    renderConcentricPath(): React.JSX.Element;
    render(): React.JSX.Element;
}
export {};
