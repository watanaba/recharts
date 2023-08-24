import React, { ReactNode, SVGProps } from 'react';
interface LayerProps {
    className?: string;
    children?: ReactNode;
}
export declare type Props = SVGProps<SVGGElement> & LayerProps;
export declare function Layer(props: Props): React.JSX.Element;
export {};
