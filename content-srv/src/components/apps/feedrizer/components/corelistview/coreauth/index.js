import { h, Component } from 'preact';
import { withRouter } from 'react-router';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { parse } from 'query-string';

import MDC from '../../mdc';
const { Card, LayoutGrid, Textfield, Button, LinearProgress } = MDC;

import AuthBtn from './authbtn';

import AppActions from '../../../actions';
import { AuthStates,  AppIds } from '../../../statics/constants/Auth';

import {
    gql,
    graphql,
	compose
} from 'react-apollo';

class CoreAuth extends Component {

	__getFilteredAppsAuthState(filter, authState) {
		return Object.keys(AppIds).filter(appId =>
			Object.keys(filter)
				.reduce((res, key) => res && authState[appId][key] === filter[key], true)
		);
	}

	__detectMultipleAuthorizingApps(authorizingAppsId){
		//currently if there are multiple IN_PROGRESS apps waiting for
		// auth tokens -> this considered to be on clients' fault
		// *if you click on all the app_authorization buttons for instance
		// and thoes state are gonna be reset. Client will need to go though
		// auth process again
		if (authorizingAppsId.length > 1) {
			const {actions} = this.props;
			console.warn('Multiple authorizing apps detected. Their state is going to be reset.');
			authorizingAppsId.forEach(appId => {
						const authEventObj = {
							appId: appId,
							event: {
								state: AuthStates.NOT_AUTHORIZED,
								auth: {}
							}
						};
						actions.authAction(authEventObj);
					}
				)

			return false;
		} else {
			return authorizingAppsId[0];
		}

	}

	__handleIncomingTokens(searchParams) {
		const {auth, history, location, actions, sync} = this.props;

		const authorizingAppId = this.__detectMultipleAuthorizingApps(
			this.__getFilteredAppsAuthState(
			{state: AuthStates.IN_PROGRESS},
			auth.authState)
		);
		if(authorizingAppId) {
				const authEventObj = {
					appId: authorizingAppId,
					event: {
						state: AuthStates.TOKEN_RECEIVED,
						auth: {
							...searchParams
						}
					}
				};
				actions.authAction(authEventObj);
				//TODO obviously
				history.push(location.path);
		}
	}

	__handleAuthSync() {

		const {auth, actions, sync} = this.props;

		const tokenReceivedAppsId =
			this.__getFilteredAppsAuthState(
			{state: AuthStates.TOKEN_RECEIVED},
			auth.authState)
		;
		if (tokenReceivedAppsId.length) {
			tokenReceivedAppsId.forEach(appId => {
				if (auth.authState[appId].state === AuthStates.TOKEN_RECEIVED) {
					sync({
						variables: {
							for_app:		appId,
							auth_params: 	auth.authState[appId].auth
						},
						update: (
							store,
							{ data: {
								sync: { access_token }
							} }) => {

							const authEventObj = {
								appId: appId,
								event: {
									state: AuthStates.AUTH_CONFIRMED
								}
							};
							actions.authAction(authEventObj);
							console.log(access_token && JSON.parse(access_token));
						}
					});
				}
			})
		}
	}

	render({auth, getAppAuthUrlMutation, history }) {
		const {location} = history;
		const {search} = location;
		const {oauth_token, oauth_verifier, code} = parse(search);

		//TODO: refac dis
		if (oauth_token || oauth_verifier || code) {
			this.__handleIncomingTokens({oauth_token, oauth_verifier, code});
		} else {
			this.__handleAuthSync();
		}

	 	return (
			<div>
				{
					Object.keys( AppIds )
						.filter(appId =>
							appId === AppIds.TWITTER ||
							appId === AppIds.FACEBOOK ||
							appId === AppIds.GOOGLE ||
							appId === AppIds.INSTAGRAM
							)
						.map(appId => ( <AuthBtn
								auth={auth}
								getAppAuthUrlMutation={getAppAuthUrlMutation}
								appId={appId}
								history={history}
								location={location}
							/>))
				}
			</div>
		)
	}
};

export const getAppAuthUrlMutation = gql`
	mutation getAuthUrl($for_app: String!) {
		getAuthUrl(for_app: $for_app) {
			auth_url
		}
	}
`;

export const sync = gql`
	mutation sync($for_app: String!, $auth_params: JSON!) {
		sync(for_app: $for_app, auth_params: $auth_params) {
			access_token
		}
	}
`;

const mapDispatch = dispatch => ({
	actions: bindActionCreators(AppActions, dispatch)
});

export default
	connect(null,mapDispatch)
	(
		withRouter(
			compose(
				graphql(getAppAuthUrlMutation, {name: "getAppAuthUrlMutation"}),
				graphql(sync, {name: "sync"}),
			)
			(CoreAuth)
		)
	);