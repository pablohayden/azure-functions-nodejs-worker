// Copyright (c) .NET Foundation. All rights reserved.
// Licensed under the MIT License.

import { FunctionCallback, FunctionMetadata, RpcBindingInfo } from '@azure/functions-core';
import { v4 as uuid } from 'uuid';
import { AzureFunctionsRpcMessages as rpc } from '../../azure-functions-language-worker-protobuf/src/rpc';
import { Disposable } from '../Disposable';
import { InternalException } from '../utils/InternalException';
import { WorkerChannel } from '../WorkerChannel';

export function registerFunction(
    channel: WorkerChannel,
    metadata: FunctionMetadata,
    callback: FunctionCallback
): Disposable {
    if (channel.hasIndexedFunctions) {
        throw new InternalException('A function can only be registered during app startup.');
    }
    const functionId = uuid();

    const rpcMetadata: rpc.IRpcFunctionMetadata = metadata;
    rpcMetadata.functionId = functionId;
    // `rawBindings` is what's actually used by the host
    // `bindings` is used by the js library in both the old host indexing and the new worker indexing
    rpcMetadata.rawBindings = Object.entries(metadata.bindings).map(([name, binding]) => {
        return convertToRawBinding(name, binding);
    });
    // The host validates that the `scriptFile` property is defined even though neither the host nor the worker needs it
    // Long term we should adjust the host to remove that unnecessary validation, but for now we'll just set it to 'n/a'
    rpcMetadata.scriptFile = 'n/a';
    channel.functions[functionId] = { metadata: rpcMetadata, callback };

    return new Disposable(() => {
        if (channel.hasIndexedFunctions) {
            throw new InternalException('A function can only be disposed during app startup.');
        } else {
            delete channel.functions[functionId];
        }
    });
}

function convertToRawBinding(name: string, binding: RpcBindingInfo): string {
    const rawBinding: any = { ...binding, name };
    switch (binding.direction) {
        case rpc.BindingInfo.Direction.in:
            rawBinding.direction = 'in';
            break;
        case rpc.BindingInfo.Direction.out:
            rawBinding.direction = 'out';
            break;
        case rpc.BindingInfo.Direction.inout:
            rawBinding.direction = 'inout';
            break;
    }
    return JSON.stringify(rawBinding);
}