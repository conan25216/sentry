import {pick, isDate, isEqualWith} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {getFormattedDate} from 'app/utils/dates';
import {t} from 'app/locale';
import DataZoom from 'app/components/charts/components/dataZoom';
import LineChart from 'app/components/charts/lineChart';
import SentryTypes from 'app/sentryTypes';
import ToolBox from 'app/components/charts/components/toolBox';
import withApi from 'app/utils/withApi';

import {EventsRequestWithParams} from './utils/eventsRequest';
import EventsContext from './utils/eventsContext';

const dateComparator = (value, other) => {
  if (isDate(value) && isDate(other)) {
    return +value === +other;
  }

  // returning undefined will use default comparator
  return undefined;
};

const isEqualWithDates = (a, b) => isEqualWith(a, b, dateComparator);
class EventsChart extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    actions: PropTypes.object,
    period: PropTypes.string,
    utc: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      period: props.period,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    const periodKeys = ['period', 'start', 'end'];
    const nextPeriod = pick(nextProps, periodKeys);
    const currentPeriod = pick(this.props, periodKeys);

    console.log(currentPeriod, nextPeriod);

    console.log('state', this.state, nextState);
    if (
      !isEqualWithDates(nextPeriod, currentPeriod) &&
      !isEqualWithDates(nextPeriod, this.state)
    ) {
      console.log('sCU', true);
      return true;
    }

    console.log('sCU', false);
    return false;
  }

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {xAxis, series} = model.option;
    const axis = xAxis[0];
    const [firstSeries] = series;

    console.log(axis.rangeStart, firstSeries.data[axis.rangeStart]);
    const start = moment.utc(firstSeries.data[axis.rangeStart][0]);
    const startFormatted = start.format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    // Add a day so we go until the end of the day (e.g. next day at midnight)
    const end = moment
      .utc(firstSeries.data[axis.rangeEnd][0])
      .add(1, 'day')
      .subtract(1, 'second');
    const endFormatted = end.format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    this.setState(
      {
        period: null,
        start: start.toDate(),
        end: end.toDate(),
      },
      () =>
        this.props.actions.updateParams({
          statsPeriod: null,
          start: startFormatted,
          end: endFormatted,
        })
    );
  };

  handleChartClick = series => {
    if (!series) {
      return;
    }

    const firstSeries = series;

    const date = moment(firstSeries.name);
    const start = date.format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    // Add a day so we go until the end of the day (e.g. next day at midnight)
    const end = date
      .add(1, 'day')
      .subtract(1, 'second')
      .format(moment.HTML5_FMT.DATETIME_LOCAL_MS);

    this.props.actions.updateParams({
      statsPeriod: null,
      start,
      end,
    });
  };

  render() {
    const {period, utc, location} = this.props;

    let interval = '1d';
    let xAxisOptions = {};
    if ((typeof period === 'string' && period.endsWith('h')) || period === '1d') {
      interval = '1h';
      xAxisOptions.axisLabel = {
        formatter: value => getFormattedDate(value, 'LT', {local: !utc}),
      };
    }

    // TODO(billy): For now only include previous period when we use relative time

    return (
      <div>
        <EventsRequestWithParams
          {...this.props}
          interval={interval}
          showLoading
          query={(location.query && location.query.query) || ''}
          getCategory={() => t('Events')}
          includePrevious={!!period}
        >
          {({timeseriesData, previousTimeseriesData}) => {
            return (
              <LineChart
                isGroupedByDate
                useUtc={utc}
                interval={interval === '1h' ? 'hour' : 'day'}
                series={timeseriesData}
                seriesOptions={{
                  showSymbol: true,
                }}
                previousPeriod={previousTimeseriesData}
                grid={{
                  left: '18px',
                  right: '18px',
                }}
                xAxis={xAxisOptions}
                dataZoom={DataZoom()}
                toolBox={ToolBox(
                  {},
                  {
                    dataZoom: {},
                    restore: {
                      title: 'Restore',
                    },
                  }
                )}
                onEvents={{
                  datazoom: this.handleDataZoom,
                  click: this.handleChartClick,
                }}
              />
            );
          }}
        </EventsRequestWithParams>
      </div>
    );
  }
}

const EventsChartContainer = withRouter(
  withApi(
    class EventsChartContainer extends React.Component {
      render() {
        return (
          <EventsContext.Consumer>
            {context => (
              <EventsChart
                {...context}
                projects={context.project || []}
                environments={context.environment || []}
                {...this.props}
              />
            )}
          </EventsContext.Consumer>
        );
      }
    }
  )
);

export default EventsChartContainer;
export {EventsChart};
