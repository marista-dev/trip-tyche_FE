import { lazy, ReactNode, Suspense } from 'react';

import { createBrowserRouter } from 'react-router-dom';

import RequireAuth from '@/domains/user/components/RequireAuth';
import RootLayout from '@/layouts/RootLayout';
import ErrorPage from '@/pages/ErrorPage';
import PageNotFound from '@/pages/PageNotFound';
import SigninPage from '@/pages/SigninPage';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';

const GlobeMapPage = lazy(() => import('@/pages/GlobeMapPage'));
const MainPage = lazy(() => import('@/pages/MainPage'));
const DevPreviewPage = lazy(() => import('@/pages/DevPreviewPage'));
const SettingPage = lazy(() => import('@/pages/SettingPage'));
const NotificationPage = lazy(() => import('@/pages/NotificationPage'));
const TripImageUploadPage = lazy(() => import('@/pages/trip/management/TripImageUploadPage'));
const TripInfoEditPage = lazy(() => import('@/pages/trip/management/TripInfoEditPage'));

const TripPages = {
    ImageByPinpointPage: lazy(() => import('@/pages/trip/route/ImageByPinpointPage')),
    TripRoutePage: lazy(() => import('@/pages/trip/route/TripRoutePage')),
    ImageByDatePage: lazy(() => import('@/pages/trip/route/ImageByDatePage')),
    TripImageManagePage: lazy(() => import('@/pages/trip/management/TripImageManagePage')),
    NoLocationResolvePage: lazy(() => import('@/pages/trip/management/NoLocationResolvePage')),
    NoDateResolvePage: lazy(() => import('@/pages/trip/management/NoDateResolvePage')),
    TimeBasedEstimatePage: lazy(() => import('@/pages/trip/management/estimate/TimeBasedEstimatePage')),
    LocationBasedEstimatePage: lazy(() => import('@/pages/trip/management/estimate/LocationBasedEstimatePage')),
    MapPickPage: lazy(() => import('@/pages/trip/management/MapPickPage')),
};

/** 인증 가드 + Suspense를 한 번에 적용하는 헬퍼. */
const protect = (element: ReactNode) => (
    <RequireAuth>
        <Suspense fallback={<Indicator />}>{element}</Suspense>
    </RequireAuth>
);

const router = createBrowserRouter([
    {
        path: ROUTES.PATH.MAIN,
        element: <RootLayout />,
        errorElement: <ErrorPage />,
        children: [
            /* ── Public ─────────────────────────── */
            {
                path: ROUTES.PATH.SIGNIN,
                element: <SigninPage />,
            },

            /* ── Protected (RequireAuth가 status 기반으로 가드) ── */
            {
                index: true,
                element: protect(<GlobeMapPage />),
            },
            {
                path: ROUTES.PATH.TICKETS,
                element: protect(<MainPage />),
            },
            ...(import.meta.env.DEV
                ? [
                      {
                          path: 'preview',
                          element: protect(<DevPreviewPage />),
                      },
                  ]
                : []),
            {
                path: ROUTES.PATH.SETTING,
                element: protect(<SettingPage />),
            },
            {
                path: `notification/:userId`,
                element: protect(<NotificationPage />),
            },
            {
                path: 'trip/:tripKey/',
                children: [
                    {
                        index: true,
                        element: protect(<TripPages.TripRoutePage />),
                    },
                    {
                        path: 'new',
                        element: protect(<TripImageUploadPage />),
                    },
                    {
                        path: 'edit/image',
                        element: protect(<TripPages.TripImageManagePage />),
                    },
                    {
                        path: 'edit/image/no-location',
                        element: protect(<TripPages.NoLocationResolvePage />),
                    },
                    {
                        path: 'edit/image/no-date',
                        element: protect(<TripPages.NoDateResolvePage />),
                    },
                    {
                        path: 'edit/image/estimate-by-time',
                        element: protect(<TripPages.TimeBasedEstimatePage />),
                    },
                    {
                        path: 'edit/image/estimate-by-location',
                        element: protect(<TripPages.LocationBasedEstimatePage />),
                    },
                    {
                        path: 'edit/image/map-pick',
                        element: protect(<TripPages.MapPickPage />),
                    },
                    {
                        path: 'edit/info',
                        element: protect(<TripInfoEditPage />),
                    },
                    {
                        path: 'image',
                        children: [
                            {
                                path: 'by-pinpoint/:pinPointId',
                                element: protect(<TripPages.ImageByPinpointPage />),
                            },
                            {
                                path: 'by-date/:date',
                                element: protect(<TripPages.ImageByDatePage />),
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        path: '/*',
        element: <PageNotFound />,
    },
]);

export default router;
