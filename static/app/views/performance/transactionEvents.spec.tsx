import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization} from 'sentry/types';
import {WebVital} from 'sentry/utils/fields';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionEvents from 'sentry/views/performance/transactionSummary/transactionEvents';
import {RouteContext} from 'sentry/views/routeContext';

// XXX(epurkhiser): This appears to also be tested by ./transactionSummary/transactionEvents/index.spec.tsx

type Data = {
  features?: string[];
  query?: {
    webVital?: WebVital;
  };
};

function initializeData({features: additionalFeatures = [], query = {}}: Data = {}) {
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
          project: '1',
          transactionCursor: '1:0:0',
          ...query,
        },
      },
    },
    project: 1,
    projects: [],
  });
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

const WrappedComponent = ({
  organization,
  router,
  ...props
}: Omit<React.ComponentProps<typeof TransactionEvents>, 'organization' | 'location'> & {
  organization: Organization;
  router: any;
}) => {
  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      <OrganizationContext.Provider value={organization}>
        <TransactionEvents
          organization={organization}
          location={router.location}
          {...props}
        />
      </OrganizationContext.Provider>
    </RouteContext.Provider>
  );
};

describe('Performance > TransactionSummary', function () {
  enforceActOnUseLegacyStoreHook();

  beforeEach(function () {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p100()': 9502,
            'p99()': 9285.7,
            'p95()': 7273.6,
            'p75()': 3639.5,
            'p50()': 755.5,
          },
        ],
        meta: {
          fields: {
            'p100()': 'duration',
            'p99()': 'duration',
            'p95()': 'duration',
            'p75()': 'duration',
            'p50()': 'duration',
          },
        },
      },
      match: [
        (_, options) => {
          return options.query?.field?.includes('p95()');
        },
      ],
    });
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
        data: [
          {
            id: 'deadbeef',
            'user.display': 'uhoh@example.com',
            'transaction.duration': 400,
            'project.id': 1,
            timestamp: '2020-05-21T15:31:18+00:00',
            trace: '1234',
            'measurements.lcp': 200,
          },
          {
            id: 'moredeadbeef',
            'user.display': 'moreuhoh@example.com',
            'transaction.duration': 600,
            'project.id': 1,
            timestamp: '2020-05-22T15:31:18+00:00',
            trace: '4321',
            'measurements.lcp': 300,
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'count()': 5161}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error.mockRestore();

    act(() => ProjectsStore.reset());
    jest.clearAllMocks();
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('TabList').find("TabWrap[data-key='events']")).toHaveLength(1);
    expect(wrapper.find('SentryDocumentTitle')).toHaveLength(1);
    expect(wrapper.find('SearchBar')).toHaveLength(1);
    expect(wrapper.find('GridEditable')).toHaveLength(1);
    expect(wrapper.find('Pagination')).toHaveLength(1);
    expect(wrapper.find('EventsContent')).toHaveLength(1);
    expect(wrapper.find('TransactionHeader')).toHaveLength(1);
  });

  it('renders relative span breakdown header when no filter selected', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('GridHeadCell')).toHaveLength(6);
    expect(
      wrapper.find('OperationTitle').children().children().children().at(0).html()
    ).toEqual(t('operation duration'));
  });

  it('renders event column results correctly', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    function keyAt(index) {
      return wrapper.find('CellAction').at(index).props().column.key;
    }

    function valueAt(index, element = 'div') {
      return wrapper.find('CellAction').at(index).find(element).last().children().html();
    }

    expect(wrapper.find('CellAction')).toHaveLength(12);
    expect(keyAt(0)).toEqual('id');
    expect(valueAt(0)).toEqual('deadbeef');
    expect(keyAt(1)).toEqual('user.display');
    expect(valueAt(1, 'span')).toEqual('uhoh@example.com');
    expect(keyAt(2)).toEqual('span_ops_breakdown.relative');
    expect(valueAt(2, 'span')).toEqual('(no value)');
    expect(keyAt(3)).toEqual('transaction.duration');
    expect(valueAt(3, 'span')).toEqual('400.00ms');
    expect(keyAt(4)).toEqual('trace');
    expect(valueAt(4)).toEqual('1234');
    expect(keyAt(5)).toEqual('timestamp');
    expect(valueAt(5, 'time')).toEqual('May 21, 2020 3:31:18 PM UTC');
  });

  it('renders additional Web Vital column', async function () {
    const initialData = initializeData({
      query: {webVital: WebVital.LCP},
    });
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        router={initialData.router}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    function keyAt(index) {
      return wrapper.find('CellAction').at(index).props().column.key;
    }

    function valueAt(index, element = 'div') {
      return wrapper.find('CellAction').at(index).find(element).last().children().html();
    }

    expect(wrapper.find('CellAction')).toHaveLength(14);
    expect(keyAt(0)).toEqual('id');
    expect(valueAt(0)).toEqual('deadbeef');
    expect(keyAt(1)).toEqual('user.display');
    expect(valueAt(1, 'span')).toEqual('uhoh@example.com');
    expect(keyAt(2)).toEqual('span_ops_breakdown.relative');
    expect(valueAt(2, 'span')).toEqual('(no value)');
    expect(keyAt(3)).toEqual('measurements.lcp');
    expect(valueAt(3)).toEqual('200');
    expect(keyAt(4)).toEqual('transaction.duration');
    expect(valueAt(4, 'span')).toEqual('400.00ms');
    expect(keyAt(5)).toEqual('trace');
    expect(valueAt(5)).toEqual('1234');
    expect(keyAt(6)).toEqual('timestamp');
    expect(valueAt(6, 'time')).toEqual('May 21, 2020 3:31:18 PM UTC');
  });
});
