import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

import { CHANGED_ASSETS } from '../queries';
import { useEffect, useState } from 'react';

enum AssetChangeType {
    ASSET_CREATED = 'ASSET_CREATED',
    ASSET_UPDATED = 'ASSET_UPDATED',
    ASSET_REPLACED = 'ASSET_REPLACED',
    ASSET_REMOVED = 'ASSET_REMOVED',
}

interface AssetChange {
    assetId: string;
    lastModified: number;
    type: AssetChangeType;
}

interface QueryResult {
    changedAssets: {
        lastModified: number;
        changes: AssetChange[];
    };
}

// Check for updates every 5 seconds
const pollInterval = 5000;

const AssetLastModifiedFragment = gql`
    fragment AssetLastModified on Asset {
        lastModified
    }
`;

export default function useChangedAssetsQuery() {
    // TODO: Set initial lastUpdate to server time
    const [lastUpdate, setLastUpdate] = useState(null);
    const [changes, setChanges] = useState<AssetChange[]>([]);

    // Query will continue to run on its own and poll the api
    const { data, client } = useQuery<QueryResult>(CHANGED_ASSETS, {
        variables: { since: lastUpdate },
        pollInterval,
    });

    // "onComplete" in the query options cannot be used, as it's only called once, due to the bug described in https://github.com/apollographql/apollo-client/issues/5531
    useEffect(() => {
        if (!data?.changedAssets) return;
        const { lastModified, changes } = data.changedAssets;
        if (lastModified) setLastUpdate(lastModified);

        // Ignore change if our cached asset version has the same `lastModified` value, which means we probably triggered the change ourselves
        const unknownChanges = changes.filter((change) => {
            const { lastModified } = client.cache.readFragment({
                fragment: AssetLastModifiedFragment,
                id: client.cache.identify({ __typename: 'Asset', id: change.assetId }),
            });
            return !lastModified || lastModified < change.lastModified;
        });
        console.table(unknownChanges);

        // TODO: Depending on the change trigger a refresh of an asset or remove it from cache/ui

        // Prevent triggering an update of the hook if we have zero changes since last time
        setChanges((prev) => (unknownChanges.length === 0 ? prev : unknownChanges));
    }, [data?.changedAssets, client]);

    return changes;
}
