import React from "react";

import { text, boolean } from "@storybook/addon-knobs/react";
import { storiesOf } from "@storybook/react";
import { wInfo } from "../utils";
import { Positionable } from "./Positionable";

const Container = ({ children }) => (
    <div
        style={{
            backgroundColor: '#d0d0d0',
            height: '300px',
            position: 'relative',
            width: '100%',
        }}
    >
        {children}
    </div>
);

storiesOf("Positionable", module).addWithJSX(
    "Basic usage",
    wInfo(`
    ### Notes

    Basic usage

    ### Usage
    ~~~js
    <Positionable
        movable
        resizable
        rotatable
        position={{
            height: '25%',
            left: '0%',
            top: '0%',
            width: '25%',
        }}
        isSelected={true}
    >
        /**
         * Your root "Contained" Element needs the
         * following styles to fill the Positionable container:
         *
         * left: 0, top: 0, width: 100%; height: 100%; position: absolute;
         */
        <Contained />
    </Positionable>
    ~~~`)(() => (
        <Container>
            <Positionable
                movable={boolean('movable', true)}
                resizable={boolean('resizable', true)}
                rotatable={boolean('rotatable', true)}
                position={{
                    height: '25%',
                    left: '37.5%',
                    top: '37.5%',
                    width: '25%',
                    rotate: '0deg',
                }}
                render={({coverAllStyle}) => (
                    <div
                        style={{
                            backgroundImage: 'url(https://picsum.photos/500/300)',
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                            backgroundColor: "#c0ffee",
                            ...coverAllStyle
                        }}
                    />
                )}
            >
            </Positionable>
        </Container>
    ))
);