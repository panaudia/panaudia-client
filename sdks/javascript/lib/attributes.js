export class PanaudiaNodeAttributes {
    constructor(uuid, name, ticket, connection) {
        this.uuid = uuid;
        this.name = name;
        this.ticket = ticket;
        this.connection = connection;
    }

    static fromJson(jsonData) {
        let info = JSON.parse(jsonData);
        if (!info) {
            return null;
        }
        return new PanaudiaNodeAttributes(
            info['uuid'],
            info['name'],
            info['ticket'],
            info['connection'],
        );
    }
}
