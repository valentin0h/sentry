import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

type Data = {
  features?: string[];
};

export const MOCK_EVENTS_TABLE_DATA = [
  {
    id: 'deadbeef',
    'user.display': 'uhoh@example.com',
    'transaction.duration': 400,
    'project.id': 1,
    timestamp: '2020-05-21T15:31:18+00:00',
    trace: '1234',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 30,
    'spans.http': 170,
    'spans.resource': 100,
    'spans.total.time': 400,
  },
  {
    id: 'moredeadbeef',
    'user.display': 'moreuhoh@example.com',
    'transaction.duration': 600,
    'project.id': 1,
    timestamp: '2020-05-22T15:31:18+00:00',
    trace: '4321',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 300,
    'spans.http': 100,
    'spans.resource': 100,
    'spans.total.time': 600,
  },
];

export const EVENTS_TABLE_RESPONSE_FIELDS = [
  'id',
  'user.display',
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  'transaction.duration',
  'trace',
  'timestamp',
  'spans.total.time',
  ...SPAN_OP_BREAKDOWN_FIELDS,
];

function initializeData({features: additionalFeatures = []}: Data = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
    apdexThreshold: 400,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: 1,
          transactionCursor: '1:0:0',
        },
      },
    },
    project: 1,
    projects: [],
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance GridEditable Table', function () {
  let transactionsListTitles;
  let totalEventCount;
  let fields;
  let organization;
  let data;
  let transactionName;
  const query =
    'transaction.duration:<15m event.type:transaction transaction:/api/0/organizations/{organization_slug}/events/';
  beforeEach(function () {
    transactionName = 'transactionName';
    totalEventCount = '100';
    transactionsListTitles = [
      t('event id'),
      t('user'),
      t('operation duration'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ];
    fields = EVENTS_TABLE_RESPONSE_FIELDS;
    organization = TestStubs.Organization();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    data = MOCK_EVENTS_TABLE_DATA;
    // Transaction list response
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
      },
      body: {
        meta: {
          fields: {
            id: 'string',
            'user.display': 'string',
            'transaction.duration': 'duration',
            'project.id': 'integer',
            timestamp: 'date',
          },
        },
        data,
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('renders ops breakdown bar when querying for span_ops_breakdown.relative', async function () {
    const initialData = initializeData();
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );
    const wrapper = mountWithTheme(
      <EventsTable
        totalEventCount={totalEventCount}
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('GridHeadCell')).toHaveLength(6);
    expect(wrapper.find('GridHeadCellStatic')).toHaveLength(0);
    expect(wrapper.find('OperationSort')).toHaveLength(1);
    expect(wrapper.find('RelativeOpsBreakdown')).toHaveLength(2);
  });

  it('renders basic columns without ops breakdown when not querying for span_ops_breakdown.relative', async function () {
    const initialData = initializeData();
    fields = [
      'id',
      'user.display',
      'transaction.duration',
      'trace',
      'timestamp',
      'spans.http',
    ];
    data.forEach(result => {
      delete result['span_ops_breakdown.relative'];
      delete result['spans.resource'];
      delete result['spans.browser'];
      delete result['spans.db'];
      delete result['spans.total.time'];
    });
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );
    const wrapper = mountWithTheme(
      <EventsTable
        totalEventCount={totalEventCount}
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('GridHeadCell')).toHaveLength(6);
    expect(wrapper.find('GridHeadCellStatic')).toHaveLength(0);
    expect(wrapper.find('OperationSort')).toHaveLength(0);
    expect(wrapper.find('RelativeOpsBreakdown')).toHaveLength(0);
  });

  it('renders event id and trace id url', async function () {
    const initialData = initializeData();
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );
    const wrapper = mountWithTheme(
      <EventsTable
        totalEventCount={totalEventCount}
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const eventIdCell = wrapper.find('a').at(3);
    const traceIdCell = wrapper.find('a').at(4);
    expect(eventIdCell.prop('href')).toMatch(
      '/organizations/org-slug/performance/undefined:deadbeef/'
    );
    expect(traceIdCell.prop('href')).toMatch(
      '/organizations/org-slug/performance/trace/1234/'
    );
  });
});
