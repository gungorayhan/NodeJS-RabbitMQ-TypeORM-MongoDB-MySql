import * as express from "express"
import * as cors from "cors"
import { createConnection } from "typeorm";
import { Product } from "./entity/product";

import * as amqp from "amqplib"


createConnection().then(db => {
    const productRepository = db.getRepository(Product);

    amqp.connect("amqp://localhost:5672", (error0, connection) => {
        if (error0) {
            throw error0
        }

        connection.createChanel((error1, channel) => {
            if (error1) {
                throw error1
            }
            const app = express();

            app.use(cors({
                origin: ["http://localhost:3000", "http://localhost:4200", "http://localhost:8080",]
            }))

            app.use(express.json());

            app.get("/api/products", async (req: express.Request, res: express.Response) => {
                console.log("first")
                const products = await productRepository.find();
                return res.json(products);
            })

            app.post("/api/products", async (req: express.Request, res: express.Response) => {
                console.log("post first")

                const product = await productRepository.create(req.body)

                const result = await productRepository.save(product);
                await channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)));
                return res.send(result);

            })

            app.get("/api/products/:id", async (req: express.Request, res: express.Response) => {
                const product = await productRepository.findOne(req.params.id);
                return res.send(product);
            })

            app.put("/api/products/:id/like", async (req: express.Request, res: express.Response) => {
                console.log("like")
                const product = await productRepository.findOne(req.params.id);
                productRepository.merge(product, req.body);
                const result = await productRepository.save(product);
                await channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)));
                return res.send(result)

            });

            app.delete("/api/products/:id", async (req: express.Request, res: express.Response) => {
                const result = await productRepository.delete(req.params.id);
                channel.sendToQueue("product_deleted", Buffer.from(req.params.id));
                return res.send(result);
            });

            app.post("/api/products/:id/like", async (req: express.Request, res: express.Response) => {
                const product = await productRepository.findOne(req.params.id);
                product.likes++;
                const result = await productRepository.save(product);
                return res.send(result)
            })
            console.log("Listening to port: 8000")
            app.listen(8000)
            process.on('beforeExit', () => {
                console.log("closing");
                connection.close();
            })
        })
    })
})