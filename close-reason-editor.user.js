// ==UserScript==
// @name             SE-Close-Reason-Editor
// @namespace        CloseReasonEditor
// @version          1.0.6
// @description      Custom off-topic close reasons for non-moderators.
// @include          http://*stackoverflow.com/*
// @include          https://*stackoverflow.com/*
// @include          http://*superuser.com/*
// @include          https://*superuser.com/*
// @include          http://*serverfault.com/*
// @include          https://*serverfault.com/*
// @include          http://*askubuntu.com/*
// @include          https://*askubuntu.com/*
// @include          http://*seasonedadvice.com/*
// @include          https://*seasonedadvice.com/*
// @include          http://*mathoverflow.net/*
// @include          https://*mathoverflow.net/*
// @include          http://*stackapps.com/*
// @include          https://*stackapps.com/*
// @include          http://*stackexchange.com/*
// @include          https://*stackexchange.com/*
// @author           Antony Lau
// ==/UserScript==

function with_jquery(f) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.textContent = "(" + f.toString() + ")(jQuery)";
    document.body.appendChild(script);
}

with_jquery(function ($) {
    if (!(window.StackExchange && StackExchange.ready)) return;
    if (!window.localStorage) return;
    if (!(window.Markdown && Markdown.makeHtml)) {
        $.getScript('//cdn.sstatic.net/Js/wmd.en.js?v=849f408083f3').done(function () {
            Markdown.Converter();
        });
    }
    var CloseReasonEditor = {
        param: {
            name: 'se-close-reason-editor',
            version: '1.0.6',
            site: location.host,
            siteName: (function () {
                var siteName = document.title;
                if (siteName.match(/ - (.*)$/)) {
                    siteName = siteName.match(/ - (.*)$/)[1];
                }
                return siteName;
            })(),
            wait: 3000,
            characters: {
                min: 30,
                max: 500,
                cool: 140,
                warm: 260,
                hot: 380
            },
            url: {
                script: 'http://laucheukhim.github.io/close-reason-editor/close-reason-editor.user.js',
                editPage: location.protocol + '//' + location.host + '/?edit-close-reasons',
                privileges: '/help/privileges',
                closePrivilege: '/help/privileges/close-questions'
            },
            reason: {
                originalTextValue: 'This question appears to be off-topic because it is about'
            }
        },
        init: function () {
            CloseReasonEditor.compatibility.init();
            switch (location.href) {
                case CloseReasonEditor.param.url.editPage:
                    CloseReasonEditor.page.init('edit');
                    break;
            }
            $(document).ajaxSuccess(function (event, xhr, settings) {
                try {
                    $(xhr.responseText).each(function () {
                        if (this.id && this.id === "popup-close-question") {
                            CloseReasonEditor.dialog.init($("#popup-close-question"));
                        }
                    });
                } catch (e) {}
            });
        },
        dialog: {
            init: function (closeDialog) {
                var otherTextarea = CloseReasonEditor.parse.otherTextarea(closeDialog);
                CloseReasonEditor.parse.closeDialog(closeDialog, function (reason) {
                    var listItem = $(this).parents("li").first();
                    var item = CloseReasonEditor.reason.getDefault(reason);
                    if (item && !item.active) {
                        listItem.remove();
                    }
                });
                if (otherTextarea.radioValue) {
                    var items = CloseReasonEditor.data.fetch()['custom'];
                    for (var i = 0; i < items.length; i++) {
                        var listItem = CloseReasonEditor.dialog.getListItem(otherTextarea.radioValue, otherTextarea.originalTextValue, items[i].html, items[i].markdown);
                        if (otherTextarea.element.parent().length) {
                            listItem.insertBefore(otherTextarea.element);
                        } else {
                            closeDialog.find("div.close-as-off-topic-pane ul.action-list").append(listItem);
                        }
                    }
                }
                closeDialog.find("div.close-as-off-topic-pane ul.action-list li").on("click", function () {
                    if ($(this).data("markdown")) {
                        $(this).find("div.off-topic-other-comment-container").append('<textarea>' + $(this).data("markdown") + '</textarea>');
                    }
                    $(this).siblings().each(function () {
                        if ($(this).find("textarea").length && !$(this).find("span.text-counter").length) {
                            $(this).find("textarea").remove();
                        }
                    });
                });
                var button;
                if (closeDialog.html().indexOf('edit these reasons') === -1) {
                    button = CloseReasonEditor.dialog.getButton('edit these reasons');
                } else {
                    button = CloseReasonEditor.dialog.getButton('edit these reasons with userscript');
                }
                closeDialog.find("div.close-as-off-topic-pane").append(button);
            },
            getListItem: function (radioValue, originalText, html, markdown) {
                return $('\
                <li class="action-selected">\
                    <label>\
                        <input type="radio" name="close-as-off-topic-reason" value="' + radioValue + '" data-subpane-name="" data-other-comment-id="">\
                        <span class="action-name">' + html + '</span>\
                    </label>\
                    <div class="off-topic-other-comment-container">\
                        <input type="hidden" name="original_text" value="' + originalText + '">\
                    </div>\
                </li>\
                ').data("markdown", markdown).on("click", function (event) {
                    event.preventDefault();
                    $(this).find("input[type='radio']").prop("checked", true);
                    $(this).parents("ul").first().find(".action-selected").removeClass("action-selected");
                    $(this).addClass("action-selected");
                    $("#popup-close-question").find("input[type='submit']").prop("disabled", false).removeClass("disabled-button").css("cursor", "");
                });
            },
            getButton: function (name) {
                return $('<a href="javascript:void(0)" style="margin-top: 20px; font-size: 11px;">' + name + '</a>').on("click", function (event) {
                    event.preventDefault();
                    location.href = CloseReasonEditor.param.url.editPage;
                }).wrap('<div></div>').parent();
            }
        },
        page: {
            html: $(),
            init: function (pageType) {
                CloseReasonEditor.page.html = $("html").clone(true, true);
                $("#content").html(CloseReasonEditor.page.template.getLoading());
                try {
                    CloseReasonEditor.page.checkReputation(function () {
                        CloseReasonEditor.page.getCloseDialog(function (closeDialog) {
                            // Set original text value
                            CloseReasonEditor.param.reason.originalTextValue = CloseReasonEditor.parse.otherTextarea(closeDialog).originalTextValue;
                            switch (pageType) {
                                case 'edit':
                                    CloseReasonEditor.page.render.edit(closeDialog);
                                    break;
                            }
                            CloseReasonEditor.utility.version.check(CloseReasonEditor.page.render.upToDate, CloseReasonEditor.page.render.needsUpdate);
                        });
                    }, function (privilegeName, minReputation) {
                        CloseReasonEditor.page.render.error(privilegeName, minReputation);
                    });
                } catch (e) {}
            },
            checkReputation: function (success, fail) {
                var html = CloseReasonEditor.page.html;
                var reputation = CloseReasonEditor.parse.reputation(html.find("a.profile-me span.reputation").text());
                var isModerator = html.find("div.topbar").html().indexOf("♦") !== -1;
                $.get(CloseReasonEditor.param.url.privileges).done(function (result) {
                    var privilegeTableRow = $(result).find("div.privilege-table-row[data-href='" + CloseReasonEditor.param.url.closePrivilege + "']");
                    var minReputation = CloseReasonEditor.parse.reputation(privilegeTableRow.find("div.rep-level").text());
                    var privilegeName = privilegeTableRow.find("div.short-description").text();
                    if (isModerator || reputation >= minReputation) {
                        success();
                    } else {
                        fail(privilegeName, minReputation);
                    }
                });
            },
            getCloseDialog: function (callback) {
                var ids = [];
                CloseReasonEditor.page.html.find("#content a.question-hyperlink").each(function () {
                    var href, match, id;
                    if (href = $(this).attr("href")) {
                        if (match = href.match(/questions\/(\d+)\//)) {
                            if (id = match[1]) {
                                ids.push(id);
                            }
                        }
                    }
                });
                var verify = function (result, status) {
                    return status === 'success' && $(result).find('#pane-main').length;
                };
                var success = function (element) {
                    callback($(element));
                };
                var count = 0;
                var start = function () {
                    if (typeof ids[count] !== 'undefined') {
                        $.get('/flags/questions/' + ids[count++] + '/close/popup').always(function (result, status) {
                            if (verify(result, status)) {
                                success(result);
                            } else {
                                restart();
                            }
                        });
                    }
                };
                var restart = function () {
                    setTimeout(start, CloseReasonEditor.param.wait);
                };
                start();
            },
            getPosition: function (element) {
                if (element instanceof HTMLElement) {
                    element = $(element);
                }
                if (element instanceof jQuery) {
                    var parents = element.parents(".item");
                    if (parents.length) {
                        var item = parents.first();
                        return item.index();
                    }
                }
                return false;
            },
            render: {
                edit: function (closeDialog) {
                    // Set title
                    document.title = 'Manage Off-Topic Close Reasons - ' + CloseReasonEditor.param.siteName;
                    // Set content template
                    $("#content").html(CloseReasonEditor.page.template.getEdit());
                    // Set default reasons
                    CloseReasonEditor.parse.closeDialog(closeDialog, function (reason) {
                        var item = CloseReasonEditor.reason.getDefault(reason);
                        if (!item) {
                            CloseReasonEditor.reason.setDefault({
                                guid: CloseReasonEditor.utility.guid(),
                                html: reason,
                                active: true
                            });
                            item = CloseReasonEditor.reason.getDefault(reason);
                        }
                        reason = CloseReasonEditor.page.reason.getActivatable(reason, item.active);
                        $("div.default-close-reasons").append(reason);
                    });
                    CloseReasonEditor.page.defaultActiveCount.update();
                    // Set custom reasons
                    var items = CloseReasonEditor.data.fetch()['custom'];
                    for (var i = 0; i < items.length; i++) {
                        $("div.custom-close-reasons").append(CloseReasonEditor.page.reason.getEditable(items[i].guid, items[i].html));
                    }
                    // Add custom reason button
                    $("#add-custom-reason").on("click", function () {
                        $("div.custom-close-reasons").append(CloseReasonEditor.page.reason.getDisposableTextarea(CloseReasonEditor.param.reason.originalTextValue));
                    });
                },
                error: function (privilegeName, minReputation) {
                    // Set title
                    document.title = 'This page requires more privileges - ' + CloseReasonEditor.param.siteName;
                    // Set content template
                    $("#content").html(CloseReasonEditor.page.template.getError(privilegeName, minReputation));
                },
                upToDate: function () {
                    $('div.userscript-version-check').html('This userscript is up to date.');
                },
                needsUpdate: function () {
                    $('div.userscript-version-check').html('A newer version of the userscript is available. <a href="' + CloseReasonEditor.param.url.script + '">Click here</a> to download.');
                }
            },
            template: {
                getEdit: function () {
                    return '\
                    <div id="mainbar">\
                        <div class="subheader">\
                            <h1>Manage Off-Topic Close Reasons</h1>\
                        </div>\
                        <h2 style="display: inline-block;">Default Off-Topic Close Reasons</h2>\
                        <span class="default-active-count" style="margin-left: 20px;">1 / 3 active</span>\
                        <p style="color: #999">The close reasons chosen by the site moderators.</p>\
                        <div class="default-close-reasons" style="margin-bottom: 40px;"></div>\
                        <h2 style="display: inline-block;">Custom Off-Topic Close Reasons</h2>\
                        <p style="color: #999">With great responsibility comes great power. Now it\'s your turn to edit these close reasons.</p>\
                        <div class="custom-close-reasons"></div>\
                        <div class="form-submit">\
                            <input id="add-custom-reason" type="submit" value="Add Custom Reason">\
                        </div>\
                    </div>\
                    ' + CloseReasonEditor.page.template.getSidebar();
                },
                getSidebar: function () {
                    return '\
                    <div id="sidebar" class="faq-page">\
                        <!--\
                        <div class="module newuser help-category-tree" id="toc">\
                            <ul>\
                                <li><a href="' + CloseReasonEditor.param.url.editPage + '">' + (location.href === CloseReasonEditor.param.url.editPage ? '<strong>Edit close reasons</strong>' : 'Edit close reasons') + '</a></li>\
                            </ul>\
                        </div>\
                        -->\
                        <div class="module legend" style="padding: 8px !important;">\
                            <h4>Close Reason Editor</h4>\
                            <div>version ' + CloseReasonEditor.param.version + '</div>\
                            <p></p>\
                            <div class="userscript-version-check">Checking for updates...</div>\
                        </div>\
                        <div class="module legend" style="padding: 8px !important;">\
                            <h4>Bug / Feature Request</h4>\
                            <div>Please head over to <a href="//stackapps.com/q/4483/20921">this post on Stack Apps</a> and file your bug report or feature request as an answer.</div>\
                        </div>\
                        <div class="module legend" style="padding: 8px !important;">\
                            <h4>License</h4>\
                            <div>This userscript is freely distributable under the terms of the <a href="//raw2.github.com/laucheukhim/close-reason-editor/master/LICENSE">MIT license</a>.</div>\
                        </div>\
                    </div>\
                    ';
                },
                getLoading: function () {
                    return '\
                    <div class="subheader">\
                        <h1>Manage Off-Topic Close Reasons</h1>\
                    </div>\
                    <div id="mainbar">\
                        <div class="content-page">\
                            <p>Loading...</p>\
                        </div>\
                    </div>\
                    <div id="sidebar"></div>\
                    ';
                },
                getError: function (privilegeName, minReputation) {
                    return '\
                    <div class="subheader">\
                        <h1>This page requires more privileges</h1>\
                    </div>\
                    <div id="mainbar">\
                        <div class="content-page">\
                            <p>The page you\'re trying to visit requires the privilege “<a href="' + CloseReasonEditor.param.url.closePrivilege + '">' + privilegeName + '</a>.”</p>\
                            <p>You receive additional privileges on ' + CloseReasonEditor.param.siteName + ' by earning more <a href="/help/whats-reputation">reputation</a> through participation on the site. When you have earned at least ' + minReputation + ' reputation, you will receive the “' + privilegeName + '” privilege and will be allowed to view this page.</p>\
                            <p>Visit the <a href="/help/privileges">privileges page</a> to learn more about the privileges you can earn.</p>\
                        </div>\
                    </div>\
                    <div id="sidebar"></div>\
                    ';
                },
                getItem: function () {
                    return $('\
                    <div class="item" style="margin-bottom: 10px;">\
                        <div class="item-left" style="float:left; width:600px;"></div>\
                        <div class="item-right" style="float: left;"></div>\
                        <div style="clear:both;"></div>\
                    </div>\
                    ');
                },
                getButton: function (name) {
                    return $('<a href="javascript:void(0)" style="margin-left: 20px;">' + name + '</a>');
                }
            },
            reason: {
                getStandard: function (reason) {
                    reason = $('<div>' + reason + '</div>').find('span.bounty-indicator-tab').remove().end().html();
                    reason = '<blockquote><p>' + reason + '</p></blockquote>';
                    return CloseReasonEditor.page.template.getItem().find('.item-left').append(reason).end();
                },
                getActivatable: function (reason, active) {
                    var reasonHTML = CloseReasonEditor.page.reason.getStandard(reason);

                    function getActivateButton() {
                        return CloseReasonEditor.page.template.getButton('activate').on('click', function (event) {
                            event.preventDefault();
                            var item = CloseReasonEditor.reason.getDefault(reason);
                            item.active = true;
                            CloseReasonEditor.reason.setDefault(item);
                            reasonHTML.find(".item-left").removeClass('deactivated').css('opacity', 1);
                            CloseReasonEditor.page.defaultActiveCount.update();
                            $(this).replaceWith(getDeactivateButton());
                        });
                    }

                    function getDeactivateButton() {
                        return CloseReasonEditor.page.template.getButton('deactivate').on('click', function (event) {
                            event.preventDefault();
                            var item = CloseReasonEditor.reason.getDefault(reason);
                            item.active = false;
                            CloseReasonEditor.reason.setDefault(item);
                            reasonHTML.find(".item-left").addClass('deactivated').css('opacity', 0.4);
                            CloseReasonEditor.page.defaultActiveCount.update();
                            $(this).replaceWith(getActivateButton());
                        });
                    }
                    var button;
                    if (active) {
                        reasonHTML.find(".item-left").css('opacity', 1);
                        button = getDeactivateButton();
                    } else {
                        reasonHTML.find(".item-left").addClass('deactivated').css('opacity', 0.4);
                        button = getActivateButton();
                    }
                    return reasonHTML.find(".item-right").append(button).end();
                },
                getEditable: function (guid, reason) {
                    reason = CloseReasonEditor.page.reason.getStandard(reason);
                    var edit = CloseReasonEditor.page.template.getButton('edit').on('click', function (event) {
                        event.preventDefault();
                        var item = CloseReasonEditor.reason.getCustom(guid);
                        var reasonTextarea = CloseReasonEditor.page.reason.getTextarea(guid, item.markdown);
                        reason.replaceWith(reasonTextarea);
                    });
                    var remove = CloseReasonEditor.page.template.getButton('remove').on('click', function (event) {
                        event.preventDefault();
                        if (confirm('Are you sure you want to remove this close reason?')) {
                            CloseReasonEditor.reason.removeCustom(guid);
                            reason.remove();
                        }
                    });
                    return reason.find('.item-right').append(edit).append(remove).end();
                },
                getTextarea: function (guid, markdown) {
                    function getNotice(length) {
                        var notice = '';
                        var difference = 0;
                        if (length === 0) {
                            difference = CloseReasonEditor.param.characters.min - length;
                            notice = 'enter at least ' + difference + ' character' + (difference === 1 ? '' : 's');
                        } else if (length < CloseReasonEditor.param.characters.min) {
                            difference = CloseReasonEditor.param.characters.min - length;
                            notice = difference + ' more to go...';
                        } else if (length <= CloseReasonEditor.param.characters.max) {
                            difference = CloseReasonEditor.param.characters.max - length;
                            notice = difference + ' character' + (difference === 1 ? '' : 's') + ' left';
                        } else {
                            difference = length - CloseReasonEditor.param.characters.max;
                            notice = 'too long by ' + difference + ' character' + (difference === 1 ? '' : 's');
                        }
                        return notice;
                    }

                    function getState(length) {
                        if (length <= CloseReasonEditor.param.characters.cool) {
                            return 'cool';
                        } else if (length <= CloseReasonEditor.param.characters.warm) {
                            return 'warm';
                        } else if (length <= CloseReasonEditor.param.characters.hot) {
                            return 'hot';
                        } else {
                            return 'supernova';
                        }
                    }

                    function isReasonValid(reason) {
                        var defaultReason = CloseReasonEditor.param.reason.originalTextValue;
                        var length = reason.length;
                        return reason.trim() !== defaultReason && length >= CloseReasonEditor.param.characters.min && length <= CloseReasonEditor.param.characters.max;
                    }
                    var reasonTextarea = CloseReasonEditor.page.template.getItem();
                    var counter = $('<span class="text-counter ' + getState(markdown.length) + '">' + getNotice(markdown.length) + '</span>');
                    var textarea = $('<textarea style="width: 99%;">' + markdown + '</textarea>').on('input', function () {
                        var length = $(this).val().length;
                        counter.attr('class', 'text-counter ' + getState(length)).html(getNotice(length));
                    });
                    var done = CloseReasonEditor.page.template.getButton('done').on('click', function (event) {
                        event.preventDefault();
                        var reason = textarea.val();
                        if (isReasonValid(reason)) {
                            CloseReasonEditor.reason.setCustom({
                                guid: guid,
                                markdown: reason,
                                position: CloseReasonEditor.page.getPosition(this)
                            });
                            reasonTextarea.replaceWith(CloseReasonEditor.page.reason.getEditable(guid, CloseReasonEditor.parse.markdown(reason)));
                        }
                    });
                    var cancel = CloseReasonEditor.page.template.getButton('cancel').on('click', function (event) {
                        event.preventDefault();
                        var custom = CloseReasonEditor.reason.getCustom(guid);
                        var reason = CloseReasonEditor.page.reason.getEditable(guid, CloseReasonEditor.parse.markdown(custom.markdown));
                        reasonTextarea.replaceWith(reason);
                    });
                    reasonTextarea.addClass('close-as-off-topic-pane');
                    reasonTextarea.addClass('close-as-off-topic-pane').find('.item-left').addClass('off-topic-other-comment-container').css({
                        display: "block",
                        marginTop: 0
                    }).append(textarea).append(counter);
                    reasonTextarea.find('.item-right').append(done).append(cancel);
                    return reasonTextarea;
                },
                getDisposableTextarea: function (markdown) {
                    var guid = CloseReasonEditor.utility.guid();
                    var reasonTextarea = CloseReasonEditor.page.reason.getTextarea(guid, markdown);
                    var cancel = CloseReasonEditor.page.template.getButton('cancel').on('click', function (event) {
                        event.preventDefault();
                        reasonTextarea.remove();
                    });
                    reasonTextarea.find('a:contains("cancel")').replaceWith(cancel);
                    return reasonTextarea;
                }
            },
            defaultActiveCount: {
                get: function () {
                    var active = 0;
                    var total = 0;
                    $("div.default-close-reasons").find("div.item").each(function () {
                        if (!$(this).find("div.item-left").hasClass("deactivated")) {
                            active++;
                        }
                        total++;
                    });
                    return {
                        active: active,
                        total: total
                    };
                },
                update: function () {
                    var count = CloseReasonEditor.page.defaultActiveCount.get();
                    $(".default-active-count").html(count.active + ' / ' + count.total + ' active');
                }
            }
        },
        parse: {
            closeDialog: function (closeDialog, callback) {
                closeDialog.find("div.close-as-off-topic-pane ul.action-list span.action-name").each(function () {
                    var item = $(this).clone(true, true);
                    item.find("a").each(function () {
                        $(this).removeAttr("target");
                    });
                    var reason = item.html();
                    if (!reason.match(/^Other:/)) {
                        callback.call(this, reason);
                    }
                });
            },
            otherTextarea: function (closeDialog) {
                var element = $();
                var radioValue = null;
                var originalTextValue = null;
                CloseReasonEditor.parse.closeDialog(closeDialog, function (reason) {
                    var listItem = $(this).parents("li").first();
                    if (listItem.find("textarea").length) {
                        element = listItem;
                        radioValue = listItem.find("input[type='radio']").val();
                        originalTextValue = listItem.find("input[name='original_text']").val();
                    }
                });
                return {
                    element: element,
                    radioValue: radioValue,
                    originalTextValue: originalTextValue
                };
            },
            reputation: function (reputationText) {
                return parseInt(reputationText.replace(/[^\d]/g, ''), 10);
            },
            markdown: function (markdown) {
                return Markdown.makeHtml(markdown).replace(/^<p>/, '').replace(/<\/p>$/, '');
            }
        },
        data: {
            getStorage: function () {
                return JSON.parse(localStorage.getItem(CloseReasonEditor.param.name));
            },
            setStorage: function (data) {
                if (typeof data === 'undefined') {
                    data = null;
                }
                localStorage.setItem(CloseReasonEditor.param.name, JSON.stringify(data));
            },
            validateAllData: function (allData) {
                return allData !== null && typeof allData === 'object';
            },
            validateData: function (data) {
                return (
                    data !== null && typeof data === 'object' && Object.prototype.toString.call(data['default']) === '[object Array]' && Object.prototype.toString.call(data['custom']) === '[object Array]');
            },
            fetch: function () {
                var data = {
                    'default': [],
                    'custom': []
                };
                var allData = CloseReasonEditor.data.getStorage();
                if (CloseReasonEditor.data.validateAllData(allData) && CloseReasonEditor.data.validateData(allData[CloseReasonEditor.param.site])) {
                    data = allData[CloseReasonEditor.param.site];
                }
                return data;
            },
            save: function (data) {
                if (CloseReasonEditor.data.validateData(data)) {
                    var allData = CloseReasonEditor.data.getStorage();
                    if (!CloseReasonEditor.data.validateAllData(allData)) {
                        allData = {};
                    }
                    allData[CloseReasonEditor.param.site] = data;
                    CloseReasonEditor.data.setStorage(allData);
                }
            }
        },
        reason: {
            get: function (type, key, value) {
                var data = CloseReasonEditor.data.fetch();
                var items = data[type];
                for (var i = 0; i < items.length; i++) {
                    if (items[i][key] === value) {
                        return items[i];
                    }
                }
                return false;
            },
            update: function (type, key, item, sort) {
                if (typeof item[key] === 'undefined') {
                    throw new Error('Key "' + key + '" does not exist in item');
                }
                var data = CloseReasonEditor.data.fetch();
                var items = data[type];
                var internalKey = false;
                for (var i = 0; i < items.length; i++) {
                    if (items[i][key] === item[key]) {
                        internalKey = i;
                        break;
                    }
                }
                if (internalKey === false) {
                    items.push(item);
                } else {
                    for (var j in item) {
                        if (item.hasOwnProperty(j)) {
                            items[i][j] = item[j];
                        }
                    }
                }
                if (typeof sort === 'string') {
                    items.sort(function (a, b) {
                        return a[sort] - b[sort];
                    });
                }
                CloseReasonEditor.data.save(data);
            },
            remove: function (type, key, value, callback) {
                var data = CloseReasonEditor.data.fetch();
                var items = data[type];
                var i;
                for (i = 0; i < items.length; i++) {
                    callback(items[i]);
                }
                for (i = 0; i < items.length; i++) {
                    if (items[i][key] === value) {
                        items.splice(i, 1);
                    }
                }
                CloseReasonEditor.data.save(data);
            },
            getDefault: function (html) {
                return CloseReasonEditor.reason.get('default', 'html', html);
            },
            setDefault: function (item) {
                CloseReasonEditor.reason.update('default', 'html', item);
            },
            getCustom: function (guid) {
                return CloseReasonEditor.reason.get('custom', 'guid', guid);
            },
            setCustom: function (item) {
                if (typeof item.markdown === 'string') {
                    item.html = CloseReasonEditor.parse.markdown(item.markdown);
                }
                CloseReasonEditor.reason.update('custom', 'guid', item, 'position');
            },
            removeCustom: function (guid) {
                var position = CloseReasonEditor.reason.getCustom(guid).position;
                CloseReasonEditor.reason.remove('custom', 'guid', guid, function (item) {
                    if (item.position > position) {
                        item.position--;
                    }
                });
            }
        },
        utility: {
            guid: function () {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0,
                        v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            },
            version: {
                upToDateCallback: function () {},
                needsUpdateCallback: function () {},
                check: function (upToDateCallback, needsUpdateCallback) {
                    CloseReasonEditor.utility.version.upToDateCallback = upToDateCallback;
                    CloseReasonEditor.utility.version.needsUpdateCallback = needsUpdateCallback;
                    $.getScript(CloseReasonEditor.param.url.script + '?' + Date.now());
                },
                compare: function (latestVersion) {
                    if (latestVersion > CloseReasonEditor.param.version) {
                        CloseReasonEditor.utility.version.needsUpdateCallback();
                    } else {
                        CloseReasonEditor.utility.version.upToDateCallback();
                    }
                }
            }
        },
        compatibility: {
            init: function () {
                CloseReasonEditor.compatibility['v1.0.5'].init();
            },
            'v1.0.5': {
                init: function () {
                    CloseReasonEditor.compatibility['v1.0.5'].updateData();
                },
                updateData: function () {
                    var data = CloseReasonEditor.data.fetch();

                    function update(items) {
                        for (var i = 0; i < items.length; i++) {
                            if (typeof items[i].hash !== 'undefined') {
                                delete items[i].hash;
                            }
                            if (typeof items[i].guid === 'undefined') {
                                items[i].guid = CloseReasonEditor.utility.guid();
                            }
                        }
                    }
                    update(data['default']);
                    update(data['custom']);
                    CloseReasonEditor.data.save(data);
                }
            }
        }
    };
    if (!window.CloseReasonEditor) {
        window.CloseReasonEditor = CloseReasonEditor;
        CloseReasonEditor.init();
    } else {
        window.CloseReasonEditor.utility.version.compare(CloseReasonEditor.param.version);
    }
});