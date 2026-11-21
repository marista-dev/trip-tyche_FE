import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { QUERY_STALE_TIME } from '@/libs/apis/shared/staleTime';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: QUERY_STALE_TIME,
        },
    },
});

const TanStackProvider = ({ children }: { children: React.ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default TanStackProvider;
