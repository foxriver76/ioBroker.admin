class InstancesWorker {
    constructor(socket) {
        this.socket = socket;
        this.handlers = [];
        this.resolve = null;
        this.promise = new Promise(resolve => this.resolve = resolve);

        this.objectChangeHandlerBound = this.objectChangeHandler.bind(this);
        this.connectionHandlerBound   = this.connectionHandler.bind(this);
        socket.registerConnectionHandler(this.connectionHandlerBound);
        socket.subscribeObject('system.adapter.*', this.objectChangeHandlerBound);
        this.connected = this.socket.isConnected();

        // read instances
        this.connected && this._readInstances();

        this.objects = null;
    }

    objectChangeHandler(id, obj) {
        // if instance
        if (id.match(/^system\.adapter\.[^.]+\.\d+$/)) {
            let type;
            let oldObj;
            if (obj) {
                if (this.objects[id]) {
                    oldObj = this.objects[id];
                    if (JSON.stringify(this.objects[id]) !== JSON.stringify(obj)) {
                        type = 'changed';
                        this.objects[id] = obj;
                    } else {
                        // no changes
                        return;
                    }
                } else {
                    type = 'new';
                    this.objects[id] = obj;
                }
            } else {
                if (this.objects[id]) {
                    oldObj = this.objects[id];
                    type = 'deleted';
                    delete this.objects[id];
                } else {
                    // deleted unknown instance
                    return;
                }
            }

            this.handlers.forEach(cb => cb([{id, obj, type, oldObj}]));
        }
    }

    // be careful with this object. Do not change them.
    getInstances(update) {
        if (!this.objects) {
            this.promise = this.promise ||
                new Promise(resolve => this.resolve = resolve);

            return this.promise;
        }

        if (!update && this.objects) {
            return Promise.resolve(this.objects);
        }

        if (update && this.objects) {
            this.resolve = null;
            this.promise = null;
        }

        this.promise = this.promise ||
            new Promise(resolve => this.resolve = resolve);

        return this.socket.getAdapterInstances(update)
            .then(objects => {
                this.objects = {};
                objects.forEach(obj => this.objects[obj._id] = obj);
                this.resolve(this.objects);
                this.resolve = null;
            });
    }

    connectionHandler(isConnected) {
        if (isConnected && !this.connected) {
            this.connected = true;
            this._readInstances(true);
        } else if (!isConnected && this.connected) {
            this.connected = false;
        }
    }
    
    registerHandler(cb) {
        this.handlers.includes(cb) && this.handlers.push(cb);
    }

    unregisterHandler(cb) {
        const pos = this.handlers.indexOf(cb);
        pos !== -1 && this.handlers.splice(pos, 1);
    }

    _readInstances(update) {
        return this.socket.getAdapterInstances(update)
            .then(objects => {
                this.objects = {};
                objects.forEach(obj => this.objects[obj._id] = obj);
                this.handlers.forEach(cb => cb(objects.map(obj => ({id: obj._id, obj, type: 'new'}))));
            });
    }
}

export default InstancesWorker;
