import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {TraceEventContext} from 'sentry/components/events/contexts/trace';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

export const traceMockData = {
  trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
  span_id: 'a5702f287954a9ef',
  parent_span_id: 'b23703998ae619e7',
  op: 'something',
  status: 'unknown',
  type: 'trace',
};

export const traceContextMetaMockData = {
  op: {
    '': {
      rem: [['project:1', 's', 0, 0]],
      len: 9,
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      trace: traceContextMetaMockData,
    },
  },
};

describe('trace event context', function () {
  const {organization, router} = initializeOrg();
  const data = {
    tags: {
      url: 'https://github.com/getsentry/sentry/',
    },
  };

  it('renders text url as a link', function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <TraceEventContext data={data} event={event} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByRole('link', {name: 'Open link'})).toHaveAttribute(
      'href',
      data.tags.url
    );
  });

  it('display redacted data', async function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <TraceEventContext data={data} event={event} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('Operation Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
