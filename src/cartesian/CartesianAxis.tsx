/**
 * @fileOverview Cartesian Axis
 */
import React, { ReactElement, ReactNode, Component, SVGProps } from 'react';
import _ from 'lodash';
import classNames from 'classnames';
import { shallowEqual } from '../util/ShallowEqual';
import { getStringSize } from '../util/DOMUtils';
import { Layer } from '../container/Layer';
import { Text } from '../component/Text';
import { Label } from '../component/Label';
import { Global } from '../util/Global';
import { isNumber, mathSign } from '../util/DataUtils';
import {
  CartesianViewBox,
  filterProps,
  TickItem,
  adaptEventsOfChild,
  PresentationAttributesAdaptChildEvent,
} from '../util/types';

interface CartesianTickItem extends TickItem {
  tickCoord?: number;
  tickSize?: number;
  isShow?: boolean;
}

export interface CartesianAxisProps {
  className?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  unit?: string | number;
  orientation?: 'top' | 'bottom' | 'left' | 'right';
  // The viewBox of svg
  viewBox?: CartesianViewBox;
  tick?: SVGProps<SVGTextElement> | ReactElement<SVGElement> | ((props: any) => ReactElement<SVGElement>) | boolean;
  axisLine?: boolean | SVGProps<SVGLineElement>;
  tickLine?: boolean | SVGProps<SVGLineElement>;
  mirror?: boolean;
  tickMargin?: number;
  hide?: boolean;
  label?: any;

  minTickGap?: number;
  ticks?: CartesianTickItem[];
  tickSize?: number;
  /** The formatter function of tick */
  tickFormatter?: (value: any, index: number) => string;
  ticksGenerator?: (props?: CartesianAxisProps) => CartesianTickItem[];
  interval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd' | 'time';
}

export type Props = Omit<PresentationAttributesAdaptChildEvent<any, SVGElement>, 'viewBox'> & CartesianAxisProps;

export class CartesianAxis extends Component<Props> {
  static displayName = 'CartesianAxis';

  static defaultProps = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    viewBox: { x: 0, y: 0, width: 0, height: 0 },
    // The orientation of axis
    orientation: 'bottom',
    // The ticks
    ticks: [] as CartesianAxisProps['ticks'],

    stroke: '#666',
    tickLine: true,
    axisLine: true,
    tick: true,
    mirror: false,

    minTickGap: 5,
    // The width or height of tick
    tickSize: 6,
    tickMargin: 2,
    interval: 'preserveEnd',
  };

  // todo Array<Tick>
  static getTicks(props: Props): any[] {
    const { tick, ticks, viewBox, minTickGap, orientation, interval, tickFormatter, unit } = props;

    if (!ticks || !ticks.length || !tick) {
      return [];
    }

    if (isNumber(interval) || Global.isSsr) {
      return CartesianAxis.getNumberIntervalTicks(
        ticks,
        typeof interval === 'number' && isNumber(interval) ? interval : 0,
      );
    }

    if (interval === 'time') {
      return CartesianAxis.getTimeTicks(ticks);
    }

    if (interval === 'preserveStartEnd') {
      return CartesianAxis.getTicksStart(
        {
          ticks,
          tickFormatter,
          viewBox,
          orientation,
          minTickGap,
          unit,
        },
        true,
      );
    }
    if (interval === 'preserveStart') {
      return CartesianAxis.getTicksStart({
        ticks,
        tickFormatter,
        viewBox,
        orientation,
        minTickGap,
        unit,
      });
    }

    return CartesianAxis.getTicksEnd({
      ticks,
      tickFormatter,
      viewBox,
      orientation,
      minTickGap,
      unit,
    });
  }

  static getNumberIntervalTicks(ticks: CartesianTickItem[], interval: number) {
    return ticks.filter((entry, i) => i % (interval + 1) === 0);
  }

  static timeTickFormatter(value: number, month: boolean): string {
    const shortMonthStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const t = new Date(value * 1000);
    if (month) {
      return `${shortMonthStr[t.getUTCMonth()]} '${t.getUTCFullYear() % 100}`;
    }
    return `${shortMonthStr[t.getUTCMonth()]} ${t.getUTCDate()}`;
  }

  static formatTimeTicks(ticks: CartesianTickItem[], month: boolean): CartesianTickItem[] {
    const result = (ticks || []).slice();
    for (let i = 0; i < ticks.length; i++) {
      result[i].value = CartesianAxis.timeTickFormatter(Number(ticks[i].value), month);
    }
    return result.filter(entry => entry.isShow);
  }

  static getDate(tick: CartesianTickItem): Date {
    return new Date(tick.value * 1000);
  }

  static shouldShowForWeek(value: number, interval: number): boolean {
    if (interval === 1) return true;
    const baseSunday = 3 * 24 * 60 * 60; // 1970年1月4日は日曜日（UNIXエポックからの4日目）
    const weeksSinceBase = Math.floor((value - baseSunday) / (7 * 24 * 60 * 60));
    switch (interval) {
      case 2:
        return weeksSinceBase % 2 === 0;
      default:
        return weeksSinceBase % 3 === 0;
    }
  }

  static shouldShowForMonth(value: number, interval: number): boolean {
    if (interval === 1) return true;
    const date = new Date(value * 1000);
    const month = date.getUTCMonth() + 1;
    switch (interval) {
      case 2:
        return month % 2 === 1;
      default:
        return month % 3 === 1;
    }
  }

  static getTimeTicks(ticks: CartesianTickItem[]) {
    const result = (ticks || []).slice();
    const len = ticks.length;
    if (len < 2) {
      return CartesianAxis.formatTimeTicks(result, false);
    }
    const start = CartesianAxis.getDate(ticks[0]); // Convert Unix timestamp to JavaScript Date object
    const end = CartesianAxis.getDate(ticks[len - 1]);
    const d = (end.getTime() - start.getTime()) / 1000 / (60 * 60 * 24);
    if (d < 10) {
      return CartesianAxis.formatTimeTicks(result, false);
    }

    // day
    if (d < 120) {
      let interval = 3;
      if (d < 10) interval = 1;
      else if (d < 60) interval = 2;
      for (let i = 0; i < len; i++) {
        if (CartesianAxis.getDate(result[i]).getUTCDay() === 0) {
          result[i].isShow = CartesianAxis.shouldShowForWeek(result[i].value, interval);
        } else {
          result[i].isShow = false;
        }
      }
      return CartesianAxis.formatTimeTicks(result, false);
    }

    // month
    let intervalMonth = 3;
    if (d < 260) intervalMonth = 1;
    else if (d < 400) intervalMonth = 2;
    for (let i = 0; i < len; i++) {
      if (CartesianAxis.getDate(result[i]).getUTCDate() === 1) {
        result[i].isShow = CartesianAxis.shouldShowForMonth(result[i].value, intervalMonth);
      } else {
        result[i].isShow = false;
      }
    }
    return CartesianAxis.formatTimeTicks(result, true);
  }

  static getTicksStart(
    { ticks, tickFormatter, viewBox, orientation, minTickGap, unit }: Omit<Props, 'tickMargin'>,
    preserveEnd?: boolean,
  ) {
    const { x, y, width, height } = viewBox;
    const sizeKey = orientation === 'top' || orientation === 'bottom' ? 'width' : 'height';
    const result = (ticks || []).slice();
    // we need add the width of 'unit' only when sizeKey === 'width'
    const unitSize = unit && sizeKey === 'width' ? getStringSize(unit)[sizeKey] : 0;
    const len = result.length;
    const sign = len >= 2 ? mathSign(result[1].coordinate - result[0].coordinate) : 1;

    let start, end;

    if (sign === 1) {
      start = sizeKey === 'width' ? x : y;
      end = sizeKey === 'width' ? x + width : y + height;
    } else {
      start = sizeKey === 'width' ? x + width : y + height;
      end = sizeKey === 'width' ? x : y;
    }

    if (preserveEnd) {
      // Try to guarantee the tail to be displayed
      let tail = ticks[len - 1];
      const tailContent = _.isFunction(tickFormatter) ? tickFormatter(tail.value, len - 1) : tail.value;
      const tailSize = getStringSize(tailContent)[sizeKey] + unitSize;
      const tailGap = sign * (tail.coordinate + (sign * tailSize) / 2 - end);
      result[len - 1] = tail = {
        ...tail,
        tickCoord: tailGap > 0 ? tail.coordinate - tailGap * sign : tail.coordinate,
      };

      const isTailShow =
        sign * (tail.tickCoord - (sign * tailSize) / 2 - start) >= 0 &&
        sign * (tail.tickCoord + (sign * tailSize) / 2 - end) <= 0;

      if (isTailShow) {
        end = tail.tickCoord - sign * (tailSize / 2 + minTickGap);
        result[len - 1] = { ...tail, isShow: true };
      }
    }

    const count = preserveEnd ? len - 1 : len;
    for (let i = 0; i < count; i++) {
      let entry = result[i];
      const content = _.isFunction(tickFormatter) ? tickFormatter(entry.value, i) : entry.value;
      const size = getStringSize(content)[sizeKey] + unitSize;

      if (i === 0) {
        const gap = sign * (entry.coordinate - (sign * size) / 2 - start);
        result[i] = entry = {
          ...entry,
          tickCoord: gap < 0 ? entry.coordinate - gap * sign : entry.coordinate,
        };
      } else {
        result[i] = entry = { ...entry, tickCoord: entry.coordinate };
      }

      const isShow =
        sign * (entry.tickCoord - (sign * size) / 2 - start) >= 0 &&
        sign * (entry.tickCoord + (sign * size) / 2 - end) <= 0;

      if (isShow) {
        start = entry.tickCoord + sign * (size / 2 + minTickGap);
        result[i] = { ...entry, isShow: true };
      }
    }

    return result.filter(entry => entry.isShow);
  }

  static getTicksEnd({ ticks, tickFormatter, viewBox, orientation, minTickGap, unit }: Omit<Props, 'tickMargin'>) {
    const { x, y, width, height } = viewBox;
    const sizeKey = orientation === 'top' || orientation === 'bottom' ? 'width' : 'height';
    // we need add the width of 'unit' only when sizeKey === 'width'
    const unitSize = unit && sizeKey === 'width' ? getStringSize(unit)[sizeKey] : 0;
    const result = (ticks || []).slice();
    const len = result.length;
    const sign = len >= 2 ? mathSign(result[1].coordinate - result[0].coordinate) : 1;

    let start, end;

    if (sign === 1) {
      start = sizeKey === 'width' ? x : y;
      end = sizeKey === 'width' ? x + width : y + height;
    } else {
      start = sizeKey === 'width' ? x + width : y + height;
      end = sizeKey === 'width' ? x : y;
    }

    for (let i = len - 1; i >= 0; i--) {
      let entry = result[i];
      const content = _.isFunction(tickFormatter) ? tickFormatter(entry.value, len - i - 1) : entry.value;
      const size = getStringSize(content)[sizeKey] + unitSize;

      if (i === len - 1) {
        const gap = sign * (entry.coordinate + (sign * size) / 2 - end);
        result[i] = entry = {
          ...entry,
          tickCoord: gap > 0 ? entry.coordinate - gap * sign : entry.coordinate,
        };
      } else {
        result[i] = entry = { ...entry, tickCoord: entry.coordinate };
      }

      const isShow =
        sign * (entry.tickCoord - (sign * size) / 2 - start) >= 0 &&
        sign * (entry.tickCoord + (sign * size) / 2 - end) <= 0;

      if (isShow) {
        end = entry.tickCoord - sign * (size / 2 + minTickGap);
        result[i] = { ...entry, isShow: true };
      }
    }

    return result.filter(entry => entry.isShow);
  }

  shouldComponentUpdate({ viewBox, ...restProps }: Props) {
    // props.viewBox is sometimes generated every time -
    // check that specially as object equality is likely to fail
    const { viewBox: viewBoxOld, ...restPropsOld } = this.props;
    return !shallowEqual(viewBox, viewBoxOld) || !shallowEqual(restProps, restPropsOld);
  }

  /**
   * Calculate the coordinates of endpoints in ticks
   * @param  {Object} data The data of a simple tick
   * @return {Object} (x1, y1): The coordinate of endpoint close to tick text
   *  (x2, y2): The coordinate of endpoint close to axis
   */
  getTickLineCoord(data: CartesianTickItem) {
    const { x, y, width, height, orientation, tickSize, mirror, tickMargin } = this.props;
    let x1, x2, y1, y2, tx, ty;

    const sign = mirror ? -1 : 1;
    const finalTickSize = data.tickSize || tickSize;
    const tickCoord = isNumber(data.tickCoord) ? data.tickCoord : data.coordinate;

    switch (orientation) {
      case 'top':
        x1 = x2 = data.coordinate;
        y2 = y + +!mirror * height;
        y1 = y2 - sign * finalTickSize;
        ty = y1 - sign * tickMargin;
        tx = tickCoord;
        break;
      case 'left':
        y1 = y2 = data.coordinate;
        x2 = x + +!mirror * width;
        x1 = x2 - sign * finalTickSize;
        tx = x1 - sign * tickMargin;
        ty = tickCoord;
        break;
      case 'right':
        y1 = y2 = data.coordinate;
        x2 = x + +mirror * width;
        x1 = x2 + sign * finalTickSize;
        tx = x1 + sign * tickMargin;
        ty = tickCoord;
        break;
      default:
        x1 = x2 = data.coordinate;
        y2 = y + +mirror * height;
        y1 = y2 + sign * finalTickSize;
        ty = y1 + sign * tickMargin;
        tx = tickCoord;
        break;
    }

    return { line: { x1, y1, x2, y2 }, tick: { x: tx, y: ty } };
  }

  getTickTextAnchor() {
    const { orientation, mirror } = this.props;
    let textAnchor;

    switch (orientation) {
      case 'left':
        textAnchor = mirror ? 'start' : 'end';
        break;
      case 'right':
        textAnchor = mirror ? 'end' : 'start';
        break;
      default:
        textAnchor = 'middle';
        break;
    }

    return textAnchor;
  }

  getTickVerticalAnchor() {
    const { orientation, mirror } = this.props;
    let verticalAnchor = 'end';

    switch (orientation) {
      case 'left':
      case 'right':
        verticalAnchor = 'middle';
        break;
      case 'top':
        verticalAnchor = mirror ? 'start' : 'end';
        break;
      default:
        verticalAnchor = mirror ? 'end' : 'start';
        break;
    }

    return verticalAnchor;
  }

  renderAxisLine() {
    const { x, y, width, height, orientation, mirror, axisLine } = this.props;
    let props: SVGProps<SVGLineElement> = {
      ...filterProps(this.props),
      ...filterProps(axisLine),
      fill: 'none',
    };

    if (orientation === 'top' || orientation === 'bottom') {
      const needHeight = +((orientation === 'top' && !mirror) || (orientation === 'bottom' && mirror));
      props = {
        ...props,
        x1: x,
        y1: y + needHeight * height,
        x2: x + width,
        y2: y + needHeight * height,
      };
    } else {
      const needWidth = +((orientation === 'left' && !mirror) || (orientation === 'right' && mirror));
      props = {
        ...props,
        x1: x + needWidth * width,
        y1: y,
        x2: x + needWidth * width,
        y2: y + height,
      };
    }

    return <line {...props} className={classNames('recharts-cartesian-axis-line', _.get(axisLine, 'className'))} />;
  }

  static renderTickItem(option: Props['tick'], props: any, value: ReactNode) {
    let tickItem;

    if (React.isValidElement(option)) {
      tickItem = React.cloneElement(option, props);
    } else if (_.isFunction(option)) {
      tickItem = option(props);
    } else {
      tickItem = (
        <Text {...props} className="recharts-cartesian-axis-tick-value">
          {value}
        </Text>
      );
    }

    return tickItem;
  }

  /**
   * render the ticks
   * @param {Array} ticks The ticks to actually render (overrides what was passed in props)
   * @return {ReactComponent} renderedTicks
   */
  renderTicks(ticks: CartesianTickItem[]) {
    const { tickLine, stroke, tick, tickFormatter, unit } = this.props;
    const finalTicks = CartesianAxis.getTicks({ ...this.props, ticks });
    const textAnchor = this.getTickTextAnchor();
    const verticalAnchor = this.getTickVerticalAnchor();
    const axisProps = filterProps(this.props);
    const customTickProps = filterProps(tick);
    const tickLineProps = {
      ...axisProps,
      fill: 'none',
      ...filterProps(tickLine),
    };
    const items = finalTicks.map((entry, i) => {
      const { line: lineCoord, tick: tickCoord } = this.getTickLineCoord(entry);
      const tickProps = {
        textAnchor,
        verticalAnchor,
        ...axisProps,
        stroke: 'none',
        fill: stroke,
        ...customTickProps,
        ...tickCoord,
        index: i,
        payload: entry,
        visibleTicksCount: finalTicks.length,
        tickFormatter,
      };

      return (
        <Layer
          className="recharts-cartesian-axis-tick"
          key={`tick-${i}`} // eslint-disable-line react/no-array-index-key
          {...adaptEventsOfChild(this.props, entry, i)}
        >
          {tickLine && (
            <line
              {...tickLineProps}
              {...lineCoord}
              className={classNames('recharts-cartesian-axis-tick-line', _.get(tickLine, 'className'))}
            />
          )}
          {tick &&
            CartesianAxis.renderTickItem(
              tick,
              tickProps,
              `${_.isFunction(tickFormatter) ? tickFormatter(entry.value, i) : entry.value}${unit || ''}`,
            )}
        </Layer>
      );
    });

    return <g className="recharts-cartesian-axis-ticks">{items}</g>;
  }

  render() {
    const { axisLine, width, height, ticksGenerator, className, hide } = this.props;

    if (hide) {
      return null;
    }

    const { ticks, ...noTicksProps } = this.props;
    let finalTicks = ticks;

    if (_.isFunction(ticksGenerator)) {
      finalTicks = ticks && ticks.length > 0 ? ticksGenerator(this.props) : ticksGenerator(noTicksProps);
    }

    if (width <= 0 || height <= 0 || !finalTicks || !finalTicks.length) {
      return null;
    }

    return (
      <Layer className={classNames('recharts-cartesian-axis', className)}>
        {axisLine && this.renderAxisLine()}
        {this.renderTicks(finalTicks)}
        {Label.renderCallByParent(this.props)}
      </Layer>
    );
  }
}
